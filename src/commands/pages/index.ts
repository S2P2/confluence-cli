import chalk from 'chalk'
import type { Command } from 'commander'
import { Analytics } from '../../analytics.js'
import type { SearchType } from '../../client/types.js'
import { getConfig } from '../../config/loader.js'
import { handleCommandError } from '../helpers.js'
import {
  buildClient,
  handleCreate,
  handleCreateChild,
  handleDelete,
  handleEdit,
  handleInfo,
  handleMove,
  handlePageList,
  handleRead,
  handleUpdate,
  resolveUrl,
} from './crud.js'
import { handleExport } from './export.js'
import { buildTree, copyPageTree, handleChildren, shouldExcludePage, type TreeNode } from './tree.js'

export function registerPageCommands(program: Command): void {
  // read
  program
    .command('read <pageId>')
    .description('Read a Confluence page by ID or URL')
    .option('-f, --format <format>', 'Output format (html, text, storage, markdown)', 'text')
    .action(async (pageId: string, options: { format: string }) => {
      const analytics = new Analytics()
      try {
        await handleRead(pageId, options, analytics)
      } catch (error) {
        handleCommandError(analytics, 'read', error)
      }
    })

  // info
  program
    .command('info <pageId>')
    .description('Get information about a Confluence page')
    .option('-f, --format <format>', 'Output format (text, json)', 'text')
    .action(async (pageId: string, options: { format: string }) => {
      const analytics = new Analytics()
      try {
        await handleInfo(pageId, options, analytics)
      } catch (error) {
        handleCommandError(analytics, 'info', error)
      }
    })

  // create
  program
    .command('create <title> <space>')
    .description('Create a new Confluence page')
    .option('-f, --file <file>', 'Read content from file')
    .option('-c, --content <content>', 'Page content as string')
    .option('--format <format>', 'Content format (storage, html, markdown)', 'storage')
    .action(
      async (
        title: string,
        space: string,
        options: {
          file?: string
          content?: string
          format?: string
        },
      ) => {
        const analytics = new Analytics()
        try {
          await handleCreate(title, space, options, analytics)
        } catch (error) {
          handleCommandError(analytics, 'create', error)
        }
      },
    )

  // create-child
  program
    .command('create-child <title> <parent>')
    .description('Create a new Confluence page as a child of another page')
    .option('-f, --file <file>', 'Read content from file')
    .option('-c, --content <content>', 'Page content as string')
    .option('--format <format>', 'Content format (storage, html, markdown)', 'storage')
    .action(
      async (
        title: string,
        parent: string,
        options: {
          file?: string
          content?: string
          format?: string
        },
      ) => {
        const analytics = new Analytics()
        try {
          await handleCreateChild(title, parent, options, analytics)
        } catch (error) {
          handleCommandError(analytics, 'create_child', error)
        }
      },
    )

  // update
  program
    .command('update <pageId>')
    .description('Update an existing Confluence page')
    .option('-t, --title <title>', 'New page title (optional)')
    .option('-f, --file <file>', 'Read content from file')
    .option('-c, --content <content>', 'Page content as string')
    .option('--format <format>', 'Content format (storage, html, markdown)', 'storage')
    .action(
      async (
        pageId: string,
        options: {
          title?: string
          file?: string
          content?: string
          format?: string
        },
      ) => {
        const analytics = new Analytics()
        try {
          await handleUpdate(pageId, options, analytics)
        } catch (error) {
          handleCommandError(analytics, 'update', error)
        }
      },
    )

  // move
  program
    .command('move <pageId> <parent>')
    .description('Move a page to a new parent location (within same space)')
    .option('-t, --title <title>', 'New page title (optional)')
    .action(async (pageId: string, parent: string, options: { title?: string }) => {
      const analytics = new Analytics()
      try {
        await handleMove(pageId, parent, options, analytics)
      } catch (error) {
        handleCommandError(analytics, 'move', error)
      }
    })

  // delete
  program
    .command('delete <pageId>')
    .description('Delete a Confluence page by ID or URL')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (pageId: string, options: { yes?: boolean }) => {
      const analytics = new Analytics()
      try {
        await handleDelete(pageId, options, analytics)
      } catch (error) {
        handleCommandError(analytics, 'delete', error)
      }
    })

  // find
  program
    .command('find <title>')
    .description('Find content by title')
    .option('-s, --space <spaceKey>', 'Limit search to specific space')
    .option('--type <type>', 'Content type (page, blog, comment, attachment)', 'page')
    .action(async (title: string, options: { space?: string; type?: string }) => {
      const analytics = new Analytics()
      try {
        const config = getConfig()
        const { pages } = buildClient(config)

        const results = await pages.findPageByTitle(title, options.space, options.type as SearchType)

        if (results.length === 0) {
          console.log(chalk.yellow('No pages found.'))
          analytics.track('find', true)
          return
        }

        console.log(chalk.blue(`Found ${results.length} page(s):`))
        for (const info of results) {
          console.log(`Title: ${chalk.green(info.title)}`)
          console.log(`ID: ${chalk.green(info.id)}`)
          if (info.space) {
            console.log(`Space: ${chalk.green(info.space.name)} (${info.space.key})`)
          }
          if (info._links?.webui) {
            console.log(`URL: ${chalk.cyan(resolveUrl(info._links))}`)
          }
        }
        analytics.track('find', true)
      } catch (error) {
        handleCommandError(analytics, 'find', error)
      }
    })

  // children
  program
    .command('children <pageId>')
    .description('List child pages of a Confluence page')
    .option('-r, --recursive', 'List all descendants recursively', false)
    .option('--max-depth <number>', 'Maximum depth for recursive listing', '10')
    .option('--format <format>', 'Output format (list, tree, json)', 'list')
    .option('--show-url', 'Show page URLs', false)
    .option('--show-id', 'Show page IDs', false)
    .action(
      async (
        pageId: string,
        options: {
          recursive?: boolean
          maxDepth?: string
          format?: string
          showUrl?: boolean
          showId?: boolean
        },
      ) => {
        const analytics = new Analytics()
        try {
          await handleChildren(pageId, options, analytics)
        } catch (error) {
          handleCommandError(analytics, 'children', error)
        }
      },
    )

  // edit
  program
    .command('edit <pageId>')
    .description('Get page content for editing')
    .option('-o, --output <file>', 'Save content to file')
    .action(async (pageId: string, options: { output?: string }) => {
      const analytics = new Analytics()
      try {
        await handleEdit(pageId, options, analytics)
      } catch (error) {
        handleCommandError(analytics, 'edit', error)
      }
    })

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
    .action(
      async (
        source: string,
        target: string,
        title: string | undefined,
        options: {
          maxDepth?: string
          exclude?: string
          delayMs?: string
          copySuffix?: string
          dryRun?: boolean
          failOnError?: boolean
          quiet?: boolean
        },
      ) => {
        const analytics = new Analytics()
        try {
          const config = getConfig()
          const { pages } = buildClient(config)

          const maxDepth = Number.parseInt(options.maxDepth ?? '10', 10) || 10
          const delayMs = Number.parseInt(options.delayMs ?? '100', 10) || 100
          const copySuffix = options.copySuffix ?? ' (Copy)'

          if (!options.quiet) {
            console.log(chalk.blue('Starting page tree copy...'))
            console.log(`Source: ${source}`)
            console.log(`Target parent: ${target}`)
            if (title) console.log(`New root title: ${title}`)
            console.log(`Max depth: ${maxDepth}`)
            console.log(`Delay: ${delayMs} ms`)
            if (copySuffix) console.log(`Root suffix: ${copySuffix}`)
            console.log('')
          }

          const excludePatterns = options.exclude
            ? options.exclude
                .split(',')
                .map((p) => p.trim())
                .filter(Boolean)
            : []

          // Dry-run: compute plan without creating anything
          if (options.dryRun) {
            const info = await pages.getPageInfo(source)
            const rootTitle = title ?? `${info.title}${copySuffix}`
            const descendants = await pages.getAllDescendantPages(source)
            const filtered =
              excludePatterns.length > 0
                ? descendants.filter((p) => !shouldExcludePage(p.title, excludePatterns))
                : descendants

            console.log(chalk.yellow('Dry run: no changes will be made.'))
            console.log(`Would create root: ${chalk.blue(rootTitle)} (under parent ${target})`)
            console.log(`Would create ${filtered.length} child page(s)`)

            const tree = buildTree(filtered, source)
            const lines: string[] = []
            const walk = (nodes: TreeNode[], depth = 0) => {
              for (const n of nodes) {
                if (lines.length >= 50) return
                lines.push(`${'  '.repeat(depth)}- ${n.title}`)
                if (n.children?.length) walk(n.children, depth + 1)
              }
            }
            walk(tree)
            if (lines.length) {
              console.log('Planned children:')
              for (const l of lines) console.log(l)
              if (filtered.length > lines.length) {
                console.log(`...and ${filtered.length - lines.length} more`)
              }
            }
            analytics.track('copy_tree_dry_run', true)
            return
          }

          // Perform the copy
          const result = await copyPageTree(pages, source, target, title, {
            maxDepth,
            excludePatterns,
            delayMs,
            copySuffix,
            quiet: options.quiet ?? false,
          })

          console.log('')
          console.log(chalk.green('Page tree copy completed'))
          console.log(`Root page: ${chalk.blue(result.rootPage.title)} (ID: ${result.rootPage.id})`)
          console.log(`Total copied pages: ${chalk.blue(result.totalCopied)}`)

          if (result.failures.length > 0) {
            console.log(chalk.yellow(`Failures: ${result.failures.length}`))
            for (const f of result.failures.slice(0, 10)) {
              const reason = f.status ? `: ${f.status}` : ''
              console.log(` - ${f.title} (ID: ${f.id})${reason}`)
            }
            if (result.failures.length > 10) {
              console.log(` - ...and ${result.failures.length - 10} more`)
            }
          }

          if (options.failOnError && result.failures.length > 0) {
            analytics.track('copy_tree', false)
            console.error(chalk.red('Completed with failures and --fail-on-error is set.'))
            process.exit(1)
          }

          analytics.track('copy_tree', true)
        } catch (error) {
          handleCommandError(analytics, 'copy_tree', error)
        }
      },
    )

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
    .action(
      async (
        pageId: string,
        options: {
          format?: string
          dest?: string
          file?: string
          attachmentsDir?: string
          pattern?: string
          referencedOnly?: boolean
          skipAttachments?: boolean
          recursive?: boolean
          maxDepth?: string
          exclude?: string
          delayMs?: string
          dryRun?: boolean
          overwrite?: boolean
        },
      ) => {
        const analytics = new Analytics()
        try {
          await handleExport(pageId, options, analytics)
        } catch (error) {
          handleCommandError(analytics, 'export', error)
        }
      },
    )

  // --- Grouped subcommands (Rust CLI convention) ---

  const page = program.command('page').description('Page operations (grouped)')

  page
    .command('get <pageId>')
    .description('Read a Confluence page by ID or URL (alias: read)')
    .option('-f, --format <format>', 'Output format (html, text, storage, markdown)', 'text')
    .option('--show-body', 'Show body content (default behavior)')
    .action(async (pageId: string, options: { format: string; showBody?: boolean }) => {
      const analytics = new Analytics()
      try {
        await handleRead(pageId, options, analytics)
      } catch (error) {
        handleCommandError(analytics, 'page_get', error)
      }
    })

  page
    .command('info <pageId>')
    .description('Get information about a Confluence page (alias: info)')
    .option('-f, --format <format>', 'Output format (text, json)', 'text')
    .action(async (pageId: string, options: { format: string }) => {
      const analytics = new Analytics()
      try {
        await handleInfo(pageId, options, analytics)
      } catch (error) {
        handleCommandError(analytics, 'page_info', error)
      }
    })

  page
    .command('create <title> <space>')
    .description('Create a new Confluence page (alias: create)')
    .option('-f, --file <file>', 'Read content from file')
    .option('-c, --content <content>', 'Page content as string')
    .option('--format <format>', 'Content format (storage, html, markdown)', 'storage')
    .action(
      async (
        title: string,
        space: string,
        options: {
          file?: string
          content?: string
          format?: string
        },
      ) => {
        const analytics = new Analytics()
        try {
          await handleCreate(title, space, options, analytics)
        } catch (error) {
          handleCommandError(analytics, 'page_create', error)
        }
      },
    )

  page
    .command('update <pageId>')
    .description('Update an existing Confluence page (alias: update)')
    .option('-t, --title <title>', 'New page title (optional)')
    .option('-f, --file <file>', 'Read content from file')
    .option('-c, --content <content>', 'Page content as string')
    .option('--format <format>', 'Content format (storage, html, markdown)', 'storage')
    .action(
      async (
        pageId: string,
        options: {
          title?: string
          file?: string
          content?: string
          format?: string
        },
      ) => {
        const analytics = new Analytics()
        try {
          await handleUpdate(pageId, options, analytics)
        } catch (error) {
          handleCommandError(analytics, 'page_update', error)
        }
      },
    )

  page
    .command('delete <pageId>')
    .description('Delete a Confluence page by ID or URL (alias: delete)')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (pageId: string, options: { yes?: boolean }) => {
      const analytics = new Analytics()
      try {
        await handleDelete(pageId, options, analytics)
      } catch (error) {
        handleCommandError(analytics, 'page_delete', error)
      }
    })

  page
    .command('move <pageId> <parent>')
    .description('Move a page to a new parent location (alias: move)')
    .option('-t, --title <title>', 'New page title (optional)')
    .action(async (pageId: string, parent: string, options: { title?: string }) => {
      const analytics = new Analytics()
      try {
        await handleMove(pageId, parent, options, analytics)
      } catch (error) {
        handleCommandError(analytics, 'page_move', error)
      }
    })

  page
    .command('tree <pageId>')
    .description('Show page tree (alias: children --recursive --format tree)')
    .option('--max-depth <number>', 'Maximum depth for recursive listing', '10')
    .option('--show-url', 'Show page URLs', false)
    .option('--show-id', 'Show page IDs', false)
    .action(
      async (
        pageId: string,
        options: {
          maxDepth?: string
          showUrl?: boolean
          showId?: boolean
        },
      ) => {
        const analytics = new Analytics()
        try {
          await handleChildren(
            pageId,
            {
              recursive: true,
              maxDepth: options.maxDepth,
              format: 'tree',
              showUrl: options.showUrl,
              showId: options.showId,
            },
            analytics,
          )
        } catch (error) {
          handleCommandError(analytics, 'page_tree', error)
        }
      },
    )

  page
    .command('list <space>')
    .description('List pages in a space')
    .option('-l, --limit <limit>', 'Maximum number of pages to fetch (default: 25)')
    .option('-f, --format <format>', 'Output format (text, json)', 'text')
    .action(async (space: string, options: { limit?: string; format?: string }) => {
      const analytics = new Analytics()
      try {
        await handlePageList(space, options, analytics)
      } catch (error) {
        handleCommandError(analytics, 'page_list', error)
      }
    })
}
