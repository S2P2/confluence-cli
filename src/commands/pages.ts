import type { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import inquirer from 'inquirer';
import { HttpClient } from '../client/http.js';
import { DefaultPagesClient } from '../client/pages.js';
import type { PagesClient } from '../client/pages.js';
import { DefaultAttachmentsClient } from '../client/attachments.js';
import { DefaultSearchClient } from '../client/search.js';
import { getConfig } from '../config/loader.js';
import { Analytics } from '../analytics.js';
import { formatPageInfo } from '../format/output.js';
import { sanitizeTitle, sanitizeFilename } from '../utils/sanitize.js';
import { uniquePathFor, writeStream } from '../utils/fs.js';
import { buildWebUrl } from '../utils/url.js';
import { assertWritable, handleCommandError } from './helpers.js';

const EXPORT_MARKER = '.confluence-export.json';

function buildClient(config: ReturnType<typeof getConfig>) {
  const http = new HttpClient(config);
  return {
    http,
    pages: new DefaultPagesClient(http),
    attachments: new DefaultAttachmentsClient(http),
    search: new DefaultSearchClient(http),
  };
}

function pageUrl(
  config: ReturnType<typeof getConfig>,
  spaceKey: string,
  pageId: string,
): string {
  return `${config.protocol}://${config.domain}/wiki${config.apiPath.replace('/rest/api', '')}/spaces/${spaceKey}/pages/${pageId}`;
}

async function handleRead(pageId: string, options: { format: string }, analytics: Analytics): Promise<void> {
  const config = getConfig();
  const { pages } = buildClient(config);

  const format = options.format.toLowerCase();
  const apiFormat: 'storage' | 'view' = format === 'html' || format === 'text' || format === 'markdown'
    ? 'view'
    : 'storage';

  const pageContent = await pages.readPage(pageId, apiFormat);

  let content: string;
  const body = pageContent.body;
  if (format === 'storage') {
    content = body.storage?.value ?? '';
  } else if (format === 'html') {
    content = body.view?.value ?? body.storage?.value ?? '';
  } else if (format === 'text') {
    const raw = body.view?.value ?? body.storage?.value ?? '';
    content = raw
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  } else {
    content = body.view?.value ?? body.storage?.value ?? '';
  }

  console.log(content);
  analytics.track('read', true);
}

async function handleInfo(pageId: string, options: { format: string }, analytics: Analytics): Promise<void> {
  const config = getConfig();
  const { pages } = buildClient(config);
  const info = await pages.getPageInfo(pageId);

  if (options.format.toLowerCase() === 'json') {
    console.log(JSON.stringify(info, null, 2));
  } else {
    console.log(formatPageInfo(info));
  }
  analytics.track('info', true);
}

async function handleCreate(title: string, space: string, options: {
  file?: string; content?: string; format?: string;
}, analytics: Analytics): Promise<void> {
  const config = getConfig();
  assertWritable(config);
  const { pages, http } = buildClient(config);

  if (!title?.trim()) throw new Error('Title is required and cannot be empty.');
  if (!space?.trim()) throw new Error('Space code is required and cannot be empty.');

  let content = '';
  if (options.file) {
    if (!fs.existsSync(options.file)) throw new Error(`File not found: ${options.file}`);
    content = fs.readFileSync(options.file, 'utf8');
  } else if (options.content) {
    content = options.content;
  } else {
    throw new Error('Either --file or --content option is required');
  }

  const result = await pages.createPage(
    title, space, content, undefined,
    (options.format ?? 'storage') as 'storage' | 'html' | 'markdown',
  );

  const url = result._links?.webui
    ? http.buildUrl(result._links.webui)
    : pageUrl(config, result.space.key, result.id);

  console.log(chalk.green('Page created successfully!'));
  console.log(`Title: ${chalk.blue(result.title)}`);
  console.log(`ID: ${chalk.blue(result.id)}`);
  console.log(`Space: ${chalk.blue(result.space.name)} (${result.space.key})`);
  console.log(`URL: ${chalk.gray(url)}`);
  analytics.track('create', true);
}

async function handleUpdate(pageId: string, options: {
  title?: string; file?: string; content?: string; format?: string;
}, analytics: Analytics): Promise<void> {
  if (!options.title && !options.file && !options.content) {
    throw new Error('At least one of --title, --file, or --content must be provided.');
  }
  if (options.title !== undefined && !options.title.trim()) {
    throw new Error('--title cannot be empty.');
  }

  const config = getConfig();
  assertWritable(config);
  const { pages, http } = buildClient(config);

  let content: string | undefined;
  if (options.file) {
    if (!fs.existsSync(options.file)) throw new Error(`File not found: ${options.file}`);
    content = fs.readFileSync(options.file, 'utf8');
  } else if (options.content) {
    content = options.content;
  }

  const result = await pages.updatePage(
    pageId, options.title, content,
    (options.format ?? 'storage') as 'storage' | 'html' | 'markdown',
  );

  const url = result._links?.webui
    ? http.buildUrl(result._links.webui)
    : pageUrl(config, result.space.key, result.id);

  console.log(chalk.green('Page updated successfully!'));
  console.log(`Title: ${chalk.blue(result.title)}`);
  console.log(`ID: ${chalk.blue(result.id)}`);
  console.log(`Version: ${chalk.blue(result.version.number)}`);
  console.log(`URL: ${chalk.gray(url)}`);
  analytics.track('update', true);
}

async function handleDelete(pageId: string, options: { yes?: boolean }, analytics: Analytics): Promise<void> {
  const config = getConfig();
  assertWritable(config);
  const { pages } = buildClient(config);

  const pageInfo = await pages.getPageInfo(pageId);

  if (!options.yes) {
    const spaceLabel = pageInfo.space?.key ? ` (${pageInfo.space.key})` : '';
    const { confirmed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmed',
      default: false,
      message: `Delete "${pageInfo.title}" (ID: ${pageInfo.id})${spaceLabel}?`,
    }]);
    if (!confirmed) {
      console.log(chalk.yellow('Cancelled.'));
      analytics.track('delete_cancel', true);
      return;
    }
  }

  await pages.deletePage(pageInfo.id);
  console.log(chalk.green('Page deleted successfully!'));
  console.log(`Title: ${chalk.blue(pageInfo.title)}`);
  console.log(`ID: ${chalk.blue(pageInfo.id)}`);
  analytics.track('delete', true);
}

async function handleMove(pageId: string, parent: string, options: { title?: string }, analytics: Analytics): Promise<void> {
  const config = getConfig();
  assertWritable(config);
  const { pages } = buildClient(config);

  await pages.movePage(pageId, parent, options.title);
  const info = await pages.getPageInfo(pageId);

  console.log(chalk.green('Page moved successfully!'));
  console.log(`Title: ${chalk.blue(options.title ?? info.title)}`);
  console.log(`ID: ${chalk.blue(info.id)}`);
  console.log(`New Parent: ${chalk.blue(parent)}`);
  console.log(`Version: ${chalk.blue(info.version.number)}`);
  analytics.track('move', true);
}

async function handleChildren(pageId: string, options: {
  recursive?: boolean; maxDepth?: string; format?: string;
  showUrl?: boolean; showId?: boolean;
}, analytics: Analytics): Promise<void> {
  const config = getConfig();
  const { pages, http } = buildClient(config);
  const format = (options.format ?? 'list').toLowerCase();

  const children = options.recursive
    ? await pages.getAllDescendantPages(pageId)
    : await pages.getChildPages(pageId);

  if (children.length === 0) {
    if (format === 'json') {
      console.log(JSON.stringify({ pageId, childCount: 0, children: [] }, null, 2));
    } else {
      console.log(chalk.yellow('No child pages found.'));
    }
    analytics.track('children', true);
    return;
  }

  if (format === 'json') {
    console.log(JSON.stringify({
      pageId,
      childCount: children.length,
      children: children.map((p) => ({
        id: p.id,
        title: p.title,
        type: p.type,
        status: p.status,
        spaceKey: p.space?.key ?? null,
        parentId: p.parentId ?? pageId,
      })),
    }, null, 2));
  } else if (format === 'tree' && options.recursive) {
    const pageInfo = await pages.getPageInfo(pageId);
    console.log(chalk.blue(`* ${pageInfo.title}`));
    const tree = buildTree(children, pageId);
    printTreeNodes(tree, http, config, options, 1);
    console.log('');
    console.log(chalk.gray(`Total: ${children.length} child page(s)`));
  } else {
    console.log(chalk.blue('Child pages:'));
    console.log('');
    for (let i = 0; i < children.length; i++) {
      const page = children[i]!;
      let output = `${i + 1}. ${chalk.green(page.title)}`;
      if (options.showId) output += ` ${chalk.gray(`(ID: ${page.id})`)}`;
      if (options.showUrl && page.space?.key) {
        const url = pageUrl(config, page.space.key, page.id);
        output += `\n   ${chalk.gray(url)}`;
      }
      if (options.recursive && page.parentId && page.parentId !== pageId) {
        output += ` ${chalk.dim('(nested)')}`;
      }
      console.log(output);
    }
    console.log('');
    console.log(chalk.gray(`Total: ${children.length} child page(s)`));
  }

  analytics.track('children', true);
}

async function handlePageList(space: string, options: {
  limit?: string; format?: string;
}, analytics: Analytics): Promise<void> {
  const config = getConfig();
  const { pages } = buildClient(config);

  const limit = options.limit ? Number.parseInt(options.limit, 10) : 25;
  if (Number.isNaN(limit) || limit <= 0) {
    throw new Error('Limit must be a positive number.');
  }

  const format = (options.format ?? 'text').toLowerCase();
  if (!['text', 'json'].includes(format)) {
    throw new Error('Format must be one of: text, json');
  }

  const result = await pages.listPages(space, limit);

  if (result.length === 0) {
    console.log(chalk.yellow('No pages found.'));
    analytics.track('page_list', true);
    return;
  }

  if (format === 'json') {
    console.log(JSON.stringify({ space, pageCount: result.length, pages: result }, null, 2));
  } else {
    console.log(chalk.blue(`Pages in space ${space} (${result.length}):`));
    for (let i = 0; i < result.length; i++) {
      const page = result[i]!;
      console.log(`${i + 1}. ${chalk.green(page.title)} ${chalk.gray(`(ID: ${page.id})`)}`);
    }
  }

  analytics.track('page_list', true);
}

export function registerPageCommands(program: Command): void {
  // read
  program
    .command('read <pageId>')
    .description('Read a Confluence page by ID or URL')
    .option('-f, --format <format>', 'Output format (html, text, storage, markdown)', 'text')
    .action(async (pageId: string, options: { format: string }) => {
      const analytics = new Analytics();
      try {
        await handleRead(pageId, options, analytics);
      } catch (error) {
        handleCommandError(analytics, 'read', error);
      }
    });

  // info
  program
    .command('info <pageId>')
    .description('Get information about a Confluence page')
    .option('-f, --format <format>', 'Output format (text, json)', 'text')
    .action(async (pageId: string, options: { format: string }) => {
      const analytics = new Analytics();
      try {
        await handleInfo(pageId, options, analytics);
      } catch (error) {
        handleCommandError(analytics, 'info', error);
      }
    });

  // create
  program
    .command('create <title> <space>')
    .description('Create a new Confluence page')
    .option('-f, --file <file>', 'Read content from file')
    .option('-c, --content <content>', 'Page content as string')
    .option('--format <format>', 'Content format (storage, html, markdown)', 'storage')
    .action(async (title: string, space: string, options: {
      file?: string; content?: string; format?: string;
    }) => {
      const analytics = new Analytics();
      try {
        await handleCreate(title, space, options, analytics);
      } catch (error) {
        handleCommandError(analytics, 'create', error);
      }
    });

  // create-child
  program
    .command('create-child <title> <parent>')
    .description('Create a new Confluence page as a child of another page')
    .option('-f, --file <file>', 'Read content from file')
    .option('-c, --content <content>', 'Page content as string')
    .option('--format <format>', 'Content format (storage, html, markdown)', 'storage')
    .action(async (title: string, parent: string, options: {
      file?: string; content?: string; format?: string;
    }) => {
      const analytics = new Analytics();
      try {
        const config = getConfig();
        assertWritable(config);
        const { pages, http } = buildClient(config);

        if (!title?.trim()) throw new Error('Title is required and cannot be empty.');
        if (!parent?.trim()) throw new Error('Parent ID is required and cannot be empty.');

        const parentInfo = await pages.getPageInfo(parent);
        const spaceKey = parentInfo.space.key;

        let content = '';
        if (options.file) {
          if (!fs.existsSync(options.file)) throw new Error(`File not found: ${options.file}`);
          content = fs.readFileSync(options.file, 'utf8');
        } else if (options.content) {
          content = options.content;
        } else {
          throw new Error('Either --file or --content option is required');
        }

        const result = await pages.createChildPage(
          title, spaceKey, parent, content,
          (options.format ?? 'storage') as 'storage' | 'html' | 'markdown',
        );

        const url = result._links?.webui
          ? http.buildUrl(result._links.webui)
          : pageUrl(config, result.space.key, result.id);

        console.log(chalk.green('Child page created successfully!'));
        console.log(`Title: ${chalk.blue(result.title)}`);
        console.log(`ID: ${chalk.blue(result.id)}`);
        console.log(`Parent: ${chalk.blue(parentInfo.title)} (${parent})`);
        console.log(`Space: ${chalk.blue(result.space.name)} (${result.space.key})`);
        console.log(`URL: ${chalk.gray(url)}`);
        analytics.track('create_child', true);
      } catch (error) {
        handleCommandError(analytics, 'create_child', error);
      }
    });

  // update
  program
    .command('update <pageId>')
    .description('Update an existing Confluence page')
    .option('-t, --title <title>', 'New page title (optional)')
    .option('-f, --file <file>', 'Read content from file')
    .option('-c, --content <content>', 'Page content as string')
    .option('--format <format>', 'Content format (storage, html, markdown)', 'storage')
    .action(async (pageId: string, options: {
      title?: string; file?: string; content?: string; format?: string;
    }) => {
      const analytics = new Analytics();
      try {
        await handleUpdate(pageId, options, analytics);
      } catch (error) {
        handleCommandError(analytics, 'update', error);
      }
    });

  // move
  program
    .command('move <pageId> <parent>')
    .description('Move a page to a new parent location (within same space)')
    .option('-t, --title <title>', 'New page title (optional)')
    .action(async (pageId: string, parent: string, options: { title?: string }) => {
      const analytics = new Analytics();
      try {
        await handleMove(pageId, parent, options, analytics);
      } catch (error) {
        handleCommandError(analytics, 'move', error);
      }
    });

  // delete
  program
    .command('delete <pageId>')
    .description('Delete a Confluence page by ID or URL')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (pageId: string, options: { yes?: boolean }) => {
      const analytics = new Analytics();
      try {
        await handleDelete(pageId, options, analytics);
      } catch (error) {
        handleCommandError(analytics, 'delete', error);
      }
    });

  // find
  program
    .command('find <title>')
    .description('Find a page by title')
    .option('-s, --space <spaceKey>', 'Limit search to specific space')
    .action(async (title: string, options: { space?: string }) => {
      const analytics = new Analytics();
      try {
        const config = getConfig();
        const { pages } = buildClient(config);

        const results = await pages.findPageByTitle(title, options.space);

        if (results.length === 0) {
          console.log(chalk.yellow('No pages found.'));
          analytics.track('find', true);
          return;
        }

        console.log(chalk.blue(`Found ${results.length} page(s):`));
        for (const info of results) {
          console.log(`Title: ${chalk.green(info.title)}`);
          console.log(`ID: ${chalk.green(info.id)}`);
          if (info.space) {
            console.log(`Space: ${chalk.green(info.space.name)} (${info.space.key})`);
          }
        }
        analytics.track('find', true);
      } catch (error) {
        handleCommandError(analytics, 'find', error);
      }
    });

  // children
  program
    .command('children <pageId>')
    .description('List child pages of a Confluence page')
    .option('-r, --recursive', 'List all descendants recursively', false)
    .option('--max-depth <number>', 'Maximum depth for recursive listing', '10')
    .option('--format <format>', 'Output format (list, tree, json)', 'list')
    .option('--show-url', 'Show page URLs', false)
    .option('--show-id', 'Show page IDs', false)
    .action(async (pageId: string, options: {
      recursive?: boolean; maxDepth?: string; format?: string;
      showUrl?: boolean; showId?: boolean;
    }) => {
      const analytics = new Analytics();
      try {
        await handleChildren(pageId, options, analytics);
      } catch (error) {
        handleCommandError(analytics, 'children', error);
      }
    });

  // edit
  program
    .command('edit <pageId>')
    .description('Get page content for editing')
    .option('-o, --output <file>', 'Save content to file')
    .action(async (pageId: string, options: { output?: string }) => {
      const analytics = new Analytics();
      try {
        const config = getConfig();
        assertWritable(config);
        const { pages } = buildClient(config);

        const pageData = await pages.readPage(pageId, 'storage');
        const content = pageData.body.storage?.value ?? '';

        console.log(chalk.blue('Page Information:'));
        console.log(`Title: ${chalk.green(pageData.title)}`);
        console.log(`ID: ${chalk.green(pageData.id)}`);
        console.log(`Version: ${chalk.green(pageData.version.number)}`);
        console.log(`Space: ${chalk.green(pageData.space.name)} (${pageData.space.key})`);
        console.log('');

        if (options.output) {
          fs.writeFileSync(options.output, content);
          console.log(chalk.green(`Content saved to: ${options.output}`));
          console.log(chalk.yellow('Edit the file and use "confluence update" to save changes'));
        } else {
          console.log(chalk.blue('Page Content:'));
          console.log(content);
        }

        analytics.track('edit', true);
      } catch (error) {
        handleCommandError(analytics, 'edit', error);
      }
    });

  // copy-tree
  program
    .command('copy-tree <source> <target> [title]')
    .description('Copy a page and all its children to a new location')
    .option('--max-depth <depth>', 'Maximum depth to copy (default: 10)', '10')
    .option('--exclude <patterns>', 'Comma-separated patterns to exclude (supports wildcards)')
    .option('--delay-ms <ms>', 'Delay between sibling creations in ms (default: 100)', '100')
    .option('--copy-suffix <suffix>', 'Suffix for new root title (default: " (Copy)")', ' (Copy)')
    .option('-n, --dry-run', 'Preview operations without creating pages')
    .option('--fail-on-error', 'Exit with non-zero code if any page fails')
    .option('-q, --quiet', 'Suppress progress output')
    .action(async (source: string, target: string, title: string | undefined, options: {
      maxDepth?: string; exclude?: string; delayMs?: string;
      copySuffix?: string; dryRun?: boolean; failOnError?: boolean; quiet?: boolean;
    }) => {
      const analytics = new Analytics();
      try {
        const config = getConfig();
        assertWritable(config);
        const { pages } = buildClient(config);

        const maxDepth = Number.parseInt(options.maxDepth ?? '10', 10) || 10;
        const delayMs = Number.parseInt(options.delayMs ?? '100', 10) || 100;
        const copySuffix = options.copySuffix ?? ' (Copy)';

        if (!options.quiet) {
          console.log(chalk.blue('Starting page tree copy...'));
          console.log(`Source: ${source}`);
          console.log(`Target parent: ${target}`);
          if (title) console.log(`New root title: ${title}`);
          console.log(`Max depth: ${maxDepth}`);
          console.log(`Delay: ${delayMs} ms`);
          if (copySuffix) console.log(`Root suffix: ${copySuffix}`);
          console.log('');
        }

        const excludePatterns = options.exclude
          ? options.exclude.split(',').map((p) => p.trim()).filter(Boolean)
          : [];

        // Dry-run: compute plan without creating anything
        if (options.dryRun) {
          const info = await pages.getPageInfo(source);
          const rootTitle = title ?? `${info.title}${copySuffix}`;
          const descendants = await pages.getAllDescendantPages(source);
          const filtered = excludePatterns.length > 0
            ? descendants.filter((p) => !shouldExcludePage(p.title, excludePatterns))
            : descendants;

          console.log(chalk.yellow('Dry run: no changes will be made.'));
          console.log(`Would create root: ${chalk.blue(rootTitle)} (under parent ${target})`);
          console.log(`Would create ${filtered.length} child page(s)`);

          const tree = buildTree(filtered, source);
          const lines: string[] = [];
          const walk = (nodes: TreeNode[], depth = 0) => {
            for (const n of nodes) {
              if (lines.length >= 50) return;
              lines.push(`${'  '.repeat(depth)}- ${n.title}`);
              if (n.children?.length) walk(n.children, depth + 1);
            }
          };
          walk(tree);
          if (lines.length) {
            console.log('Planned children:');
            for (const l of lines) console.log(l);
            if (filtered.length > lines.length) {
              console.log(`...and ${filtered.length - lines.length} more`);
            }
          }
          analytics.track('copy_tree_dry_run', true);
          return;
        }

        // Perform the copy
        const result = await copyPageTree(pages, source, target, title, {
          maxDepth, excludePatterns, delayMs, copySuffix,
          quiet: options.quiet ?? false,
        });

        console.log('');
        console.log(chalk.green('Page tree copy completed'));
        console.log(`Root page: ${chalk.blue(result.rootPage.title)} (ID: ${result.rootPage.id})`);
        console.log(`Total copied pages: ${chalk.blue(result.totalCopied)}`);

        if (result.failures.length > 0) {
          console.log(chalk.yellow(`Failures: ${result.failures.length}`));
          for (const f of result.failures.slice(0, 10)) {
            const reason = f.status ? `: ${f.status}` : '';
            console.log(` - ${f.title} (ID: ${f.id})${reason}`);
          }
          if (result.failures.length > 10) {
            console.log(` - ...and ${result.failures.length - 10} more`);
          }
        }

        if (options.failOnError && result.failures.length > 0) {
          analytics.track('copy_tree', false);
          console.error(chalk.red('Completed with failures and --fail-on-error is set.'));
          process.exit(1);
        }

        analytics.track('copy_tree', true);
      } catch (error) {
        handleCommandError(analytics, 'copy_tree', error);
      }
    });

  // export
  program
    .command('export <pageId>')
    .description('Export a page to a directory with its attachments')
    .option('--format <format>', 'Content format (html, text, markdown)', 'markdown')
    .option('--dest <directory>', 'Base directory to export into', '.')
    .option('--file <filename>', 'Content filename (default: page.<ext>)')
    .option('--attachments-dir <name>', 'Subdirectory for attachments', 'attachments')
    .option('--pattern <glob>', 'Filter attachments by filename (e.g., "*.png")')
    .option('--referenced-only', 'Download only attachments referenced in the page content')
    .option('--skip-attachments', 'Do not download attachments')
    .option('-r, --recursive', 'Export page and all descendants')
    .option('--max-depth <depth>', 'Limit recursion depth (default: 10)')
    .option('--exclude <patterns>', 'Comma-separated title glob patterns to skip')
    .option('--delay-ms <ms>', 'Delay between page exports in ms (default: 100)')
    .option('--dry-run', 'Preview pages without writing files')
    .option('--overwrite', 'Overwrite existing export directory')
    .action(async (pageId: string, options: {
      format?: string; dest?: string; file?: string;
      attachmentsDir?: string; pattern?: string;
      referencedOnly?: boolean; skipAttachments?: boolean;
      recursive?: boolean; maxDepth?: string; exclude?: string;
      delayMs?: string; dryRun?: boolean; overwrite?: boolean;
    }) => {
      const analytics = new Analytics();
      try {
        const config = getConfig();
        const { pages, attachments } = buildClient(config);

        if (options.recursive) {
          await exportRecursive(pages, attachments, pageId, options);
          analytics.track('export', true);
          return;
        }

        const format = (options.format ?? 'markdown').toLowerCase();
        const formatExt: Record<string, string> = { markdown: 'md', html: 'html', text: 'txt' };
        const contentExt = formatExt[format] ?? 'txt';

        const pageInfo = await pages.getPageInfo(pageId);
        const apiFormat = format === 'markdown' || format === 'text' ? 'view' : 'storage';
        const pageContent = await pages.readPage(pageId, apiFormat);
        const content = pageContent.body.view?.value ?? pageContent.body.storage?.value ?? '';

        const baseDir = path.resolve(options.dest ?? '.');
        const folderName = sanitizeTitle(pageInfo.title);
        const exportDir = path.join(baseDir, folderName);

        if (options.overwrite && fs.existsSync(exportDir)) {
          if (!isExportDirectory(exportDir)) {
            throw new Error(
              `Refusing to overwrite "${exportDir}" - it was not created by confluence-cli (missing ${EXPORT_MARKER}).`,
            );
          }
          fs.rmSync(exportDir, { recursive: true, force: true });
        }
        fs.mkdirSync(exportDir, { recursive: true });

        const contentFile = options.file ?? `page.${contentExt}`;
        const contentPath = path.join(exportDir, contentFile);
        fs.writeFileSync(contentPath, content);
        writeExportMarker(exportDir, { pageId, title: pageInfo.title });

        console.log(chalk.green('Page exported'));
        console.log(`Title: ${chalk.blue(pageInfo.title)}`);
        console.log(`Content: ${chalk.gray(contentPath)}`);

        if (!options.skipAttachments) {
          const allAttachments = await attachments.getAll(pageId);
          const pattern = options.pattern?.trim();
          const filtered = pattern
            ? allAttachments.filter((att) => attachments.matchesPattern(att.title, pattern))
            : allAttachments;

          if (filtered.length === 0) {
            console.log(chalk.yellow('No attachments to download.'));
          } else {
            const attachmentsDir = path.join(exportDir, options.attachmentsDir ?? 'attachments');
            fs.mkdirSync(attachmentsDir, { recursive: true });

            let downloaded = 0;
            for (const att of filtered) {
              const targetPath = uniquePathFor(attachmentsDir, att.title);
              await attachments.download(pageId, att.downloadLink, targetPath);
              downloaded += 1;
              console.log(`  ${chalk.green(att.title)} -> ${chalk.gray(targetPath)}`);
            }
            console.log(chalk.green(`Downloaded ${downloaded} attachment(s) to ${attachmentsDir}`));
          }
        }

        analytics.track('export', true);
      } catch (error) {
        handleCommandError(analytics, 'export', error);
      }
    });

  // --- Grouped subcommands (Rust CLI convention) ---

  const page = program
    .command('page')
    .description('Page operations (grouped)');

  page
    .command('get <pageId>')
    .description('Read a Confluence page by ID or URL (alias: read)')
    .option('-f, --format <format>', 'Output format (html, text, storage, markdown)', 'text')
    .option('--show-body', 'Show body content (default behavior)')
    .action(async (pageId: string, options: { format: string; showBody?: boolean }) => {
      const analytics = new Analytics();
      try {
        await handleRead(pageId, options, analytics);
      } catch (error) {
        handleCommandError(analytics, 'page_get', error);
      }
    });

  page
    .command('info <pageId>')
    .description('Get information about a Confluence page (alias: info)')
    .option('-f, --format <format>', 'Output format (text, json)', 'text')
    .action(async (pageId: string, options: { format: string }) => {
      const analytics = new Analytics();
      try {
        await handleInfo(pageId, options, analytics);
      } catch (error) {
        handleCommandError(analytics, 'page_info', error);
      }
    });

  page
    .command('create <title> <space>')
    .description('Create a new Confluence page (alias: create)')
    .option('-f, --file <file>', 'Read content from file')
    .option('-c, --content <content>', 'Page content as string')
    .option('--format <format>', 'Content format (storage, html, markdown)', 'storage')
    .action(async (title: string, space: string, options: {
      file?: string; content?: string; format?: string;
    }) => {
      const analytics = new Analytics();
      try {
        await handleCreate(title, space, options, analytics);
      } catch (error) {
        handleCommandError(analytics, 'page_create', error);
      }
    });

  page
    .command('update <pageId>')
    .description('Update an existing Confluence page (alias: update)')
    .option('-t, --title <title>', 'New page title (optional)')
    .option('-f, --file <file>', 'Read content from file')
    .option('-c, --content <content>', 'Page content as string')
    .option('--format <format>', 'Content format (storage, html, markdown)', 'storage')
    .action(async (pageId: string, options: {
      title?: string; file?: string; content?: string; format?: string;
    }) => {
      const analytics = new Analytics();
      try {
        await handleUpdate(pageId, options, analytics);
      } catch (error) {
        handleCommandError(analytics, 'page_update', error);
      }
    });

  page
    .command('delete <pageId>')
    .description('Delete a Confluence page by ID or URL (alias: delete)')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (pageId: string, options: { yes?: boolean }) => {
      const analytics = new Analytics();
      try {
        await handleDelete(pageId, options, analytics);
      } catch (error) {
        handleCommandError(analytics, 'page_delete', error);
      }
    });

  page
    .command('move <pageId> <parent>')
    .description('Move a page to a new parent location (alias: move)')
    .option('-t, --title <title>', 'New page title (optional)')
    .action(async (pageId: string, parent: string, options: { title?: string }) => {
      const analytics = new Analytics();
      try {
        await handleMove(pageId, parent, options, analytics);
      } catch (error) {
        handleCommandError(analytics, 'page_move', error);
      }
    });

  page
    .command('tree <pageId>')
    .description('Show page tree (alias: children --recursive --format tree)')
    .option('--max-depth <number>', 'Maximum depth for recursive listing', '10')
    .option('--show-url', 'Show page URLs', false)
    .option('--show-id', 'Show page IDs', false)
    .action(async (pageId: string, options: {
      maxDepth?: string; showUrl?: boolean; showId?: boolean;
    }) => {
      const analytics = new Analytics();
      try {
        await handleChildren(pageId, {
          recursive: true,
          maxDepth: options.maxDepth,
          format: 'tree',
          showUrl: options.showUrl,
          showId: options.showId,
        }, analytics);
      } catch (error) {
        handleCommandError(analytics, 'page_tree', error);
      }
    });

  page
    .command('list <space>')
    .description('List pages in a space')
    .option('-l, --limit <limit>', 'Maximum number of pages to fetch (default: 25)')
    .option('-f, --format <format>', 'Output format (text, json)', 'text')
    .action(async (space: string, options: { limit?: string; format?: string }) => {
      const analytics = new Analytics();
      try {
        await handlePageList(space, options, analytics);
      } catch (error) {
        handleCommandError(analytics, 'page_list', error);
      }
    });
}

// --- Tree helpers ---

interface TreeNode {
  id: string;
  title: string;
  children: TreeNode[];
  space?: { key: string };
  [key: string]: unknown;
}

function buildTree(pages: Array<{ id: string; title: string; parentId?: string; space?: { key: string } }>, rootId: string): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const tree: TreeNode[] = [];

  for (const page of pages) {
    map.set(page.id, { ...page, children: [] });
  }

  for (const page of pages) {
    const node = map.get(page.id)!;
    const parentId = page.parentId ?? rootId;
    if (parentId === rootId) {
      tree.push(node);
    } else {
      const parent = map.get(parentId);
      if (parent) parent.children.push(node);
    }
  }

  return tree;
}

function printTreeNodes(
  nodes: TreeNode[],
  http: HttpClient,
  config: ReturnType<typeof getConfig>,
  options: { showId?: boolean; showUrl?: boolean },
  depth: number,
): void {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    const isLast = i === nodes.length - 1;
    const indent = '  '.repeat(depth - 1);
    const prefix = isLast ? '\u2514\u2500\u2500 ' : '\u251C\u2500\u2500 ';

    let output = `${indent}${prefix}${chalk.green(node.title)}`;
    if (options.showId) output += ` ${chalk.gray(`(ID: ${node.id})`)}`;
    if (options.showUrl && node.space?.key) {
      const url = pageUrl(config, node.space.key, node.id);
      output += `\n${indent}${isLast ? '    ' : '\u2502   '}${chalk.gray(url)}`;
    }
    console.log(output);

    if (node.children?.length) {
      printTreeNodes(node.children, http, config, options, depth + 1);
    }
  }
}

function shouldExcludePage(title: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    const regexStr = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    if (new RegExp(`^${regexStr}$`, 'i').test(title)) return true;
  }
  return false;
}

// --- Copy tree implementation ---

interface CopyTreeResult {
  rootPage: { id: string; title: string };
  totalCopied: number;
  failures: Array<{ id: string; title: string; status?: string }>;
}

async function copyPageTree(
  pages: PagesClient,
  sourceId: string,
  targetParentId: string,
  newTitle: string | undefined,
  opts: {
    maxDepth: number; excludePatterns: string[]; delayMs: number;
    copySuffix: string; quiet: boolean;
  },
): Promise<CopyTreeResult> {
  const sourceInfo = await pages.getPageInfo(sourceId);
  const rootTitle = newTitle ?? `${sourceInfo.title}${opts.copySuffix}`;

  const rootResult = await pages.createPage(rootTitle, sourceInfo.space.key, '', targetParentId);
  if (!opts.quiet) {
    console.log(`Created root: ${chalk.blue(rootResult.title)} (ID: ${rootResult.id})`);
  }

  let totalCopied = 1;
  const failures: CopyTreeResult['failures'] = [];

  const descendants = await pages.getAllDescendantPages(sourceId);
  const filtered = opts.excludePatterns.length > 0
    ? descendants.filter((p) => !shouldExcludePage(p.title, opts.excludePatterns))
    : descendants;

  const tree = buildTree(filtered, sourceId);

  async function copyLevel(nodes: TreeNode[], parentId: string, depth: number): Promise<void> {
    if (depth >= opts.maxDepth) return;
    for (const node of nodes) {
      try {
        const sourceContent = await pages.readPage(node.id, 'storage');
        const content = sourceContent.body.storage?.value ?? '';
        const result = await pages.createPage(
          node.title, sourceInfo.space.key, content, parentId,
        );
        totalCopied++;
        if (!opts.quiet) {
          console.log(`  Created: ${chalk.blue(node.title)} (ID: ${result.id})`);
        }
        if (node.children?.length) {
          await copyLevel(node.children, result.id, depth + 1);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        failures.push({ id: node.id, title: node.title, status: msg });
        if (!opts.quiet) {
          console.error(chalk.red(`  Failed: ${node.title} - ${msg}`));
        }
      }
      if (opts.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, opts.delayMs));
      }
    }
  }

  await copyLevel(tree, rootResult.id, 0);

  return {
    rootPage: { id: rootResult.id, title: rootResult.title },
    totalCopied,
    failures,
  };
}

// --- Export helpers ---

function writeExportMarker(exportDir: string, meta: { pageId: string; title: string }): void {
  const marker = {
    exportedAt: new Date().toISOString(),
    pageId: meta.pageId,
    title: meta.title,
    tool: 'confluence-cli',
  };
  fs.writeFileSync(path.join(exportDir, EXPORT_MARKER), JSON.stringify(marker, null, 2));
}

function isExportDirectory(dir: string): boolean {
  return fs.existsSync(path.join(dir, EXPORT_MARKER));
}

async function exportRecursive(
  pages: PagesClient,
  attachments: InstanceType<typeof DefaultAttachmentsClient>,
  pageId: string,
  options: {
    format?: string; dest?: string; file?: string;
    attachmentsDir?: string; pattern?: string;
    referencedOnly?: boolean; skipAttachments?: boolean;
    maxDepth?: string; exclude?: string;
    delayMs?: string; dryRun?: boolean; overwrite?: boolean;
  },
): Promise<void> {
  const format = (options.format ?? 'markdown').toLowerCase();
  const formatExt: Record<string, string> = { markdown: 'md', html: 'html', text: 'txt' };
  const contentExt = formatExt[format] ?? 'txt';
  const contentFile = options.file ?? `page.${contentExt}`;
  const baseDir = path.resolve(options.dest ?? '.');
  const delayMs = Number.parseInt(options.delayMs ?? '100', 10) || 100;

  const rootPage = await pages.getPageInfo(pageId);
  console.log(`Fetching descendants of "${chalk.blue(rootPage.title)}"...`);

  const descendants = await pages.getAllDescendantPages(pageId);
  const excludePatterns = options.exclude
    ? options.exclude.split(',').map((p) => p.trim()).filter(Boolean)
    : [];

  const allPages = [{ id: rootPage.id, title: rootPage.title, parentId: undefined as string | undefined }];
  for (const page of descendants) {
    if (excludePatterns.length && shouldExcludePage(page.title, excludePatterns)) continue;
    allPages.push({ id: page.id, title: page.title, parentId: page.parentId });
  }

  const totalPages = allPages.length;
  console.log(`Found ${chalk.blue(totalPages)} page(s) to export.`);

  if (options.dryRun) {
    const printDryRun = (items: typeof allPages, indent = '') => {
      for (const item of items) {
        console.log(`${indent}${chalk.blue(item.title)} (${item.id})`);
        const children = allPages.filter((p) => p.parentId === item.id);
        if (children.length) printDryRun(children, indent + '  ');
      }
    };
    const roots = allPages.filter((p) => !p.parentId || p.parentId === pageId);
    printDryRun(roots.length > 0 ? roots : [allPages[0]!]);
    console.log(chalk.yellow('\nDry run - no files written.'));
    return;
  }

  if (options.overwrite) {
    const rootFolderName = sanitizeTitle(rootPage.title);
    const rootExportDir = path.join(baseDir, rootFolderName);
    if (fs.existsSync(rootExportDir)) {
      if (!isExportDirectory(rootExportDir)) {
        throw new Error(
          `Refusing to overwrite "${rootExportDir}" - it was not created by confluence-cli.`,
        );
      }
      fs.rmSync(rootExportDir, { recursive: true, force: true });
    }
  }

  let exported = 0;
  const failures: Array<{ id: string; title: string; error: string }> = [];

  async function exportPage(page: { id: string; title: string }, dir: string): Promise<string> {
    exported++;
    console.log(`[${exported}/${totalPages}] Exporting: ${chalk.blue(page.title)}`);

    const folderName = sanitizeTitle(page.title);
    let exportDir = path.join(dir, folderName);

    if (fs.existsSync(exportDir)) {
      let counter = 1;
      while (fs.existsSync(`${exportDir} (${counter})`)) counter++;
      exportDir = `${exportDir} (${counter})`;
    }
    fs.mkdirSync(exportDir, { recursive: true });

    const apiFormat = format === 'markdown' || format === 'text' ? 'view' : 'storage';
    const pageContent = await pages.readPage(page.id, apiFormat);
    const content = pageContent.body.view?.value ?? pageContent.body.storage?.value ?? '';
    fs.writeFileSync(path.join(exportDir, contentFile), content);

    if (!options.skipAttachments) {
      const allAtts = await attachments.getAll(page.id);
      const pattern = options.pattern?.trim();
      const filtered = pattern
        ? allAtts.filter((att) => attachments.matchesPattern(att.title, pattern))
        : allAtts;

      if (filtered.length > 0) {
        const attDir = path.join(exportDir, options.attachmentsDir ?? 'attachments');
        fs.mkdirSync(attDir, { recursive: true });
        for (const att of filtered) {
          const targetPath = uniquePathFor(attDir, att.title);
          await attachments.download(page.id, att.downloadLink, targetPath);
        }
      }
    }

    return exportDir;
  }

  // Export root
  let rootDir: string;
  try {
    rootDir = await exportPage(rootPage, baseDir);
    writeExportMarker(rootDir, { pageId, title: rootPage.title });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`  Failed: ${rootPage.title} - ${msg}`));
    throw new Error(`Failed to export root page: ${msg}`);
  }

  // Export descendants in tree order
  async function walkTree(parentId: string, parentDir: string): Promise<void> {
    const children = allPages.filter(
      (p) => p.parentId === parentId && p.id !== rootPage.id,
    );
    for (const child of children) {
      try {
        const childDir = await exportPage(child, parentDir);
        await walkTree(child.id, childDir);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        failures.push({ id: child.id, title: child.title, error: msg });
        console.error(chalk.red(`  Failed: ${child.title} - ${msg}`));
      }
      if (delayMs > 0 && exported < totalPages) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  await walkTree(pageId, rootDir);

  const succeeded = exported - failures.length;
  console.log(chalk.green(`\nExported ${succeeded}/${totalPages} page(s) to ${rootDir}`));
  if (failures.length > 0) {
    console.log(chalk.red(`\n${failures.length} failure(s):`));
    for (const f of failures) {
      console.log(chalk.red(`  - ${f.title} (${f.id}): ${f.error}`));
    }
  }
}
