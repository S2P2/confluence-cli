import type { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import inquirer from 'inquirer';
import { HttpClient } from '../client/http.js';
import { DefaultAttachmentsClient } from '../client/attachments.js';
import { getConfig } from '../config/loader.js';
import { Analytics } from '../analytics.js';
import { uniquePathFor, writeStream } from '../utils/fs.js';

function assertWritable(config: { readOnly: boolean }): void {
  if (config.readOnly) {
    console.error(
      chalk.red('Error: This profile is in read-only mode. Write operations are not allowed.'),
    );
    process.exit(1);
  }
}

function buildAttachmentsClient(config: ReturnType<typeof getConfig>): DefaultAttachmentsClient {
  const http = new HttpClient(config);
  return new DefaultAttachmentsClient(http);
}

function handleCommandError(analytics: Analytics, commandName: string, error: unknown): never {
  analytics.track(commandName, false);
  const message = error instanceof Error ? error.message : String(error);
  console.error(chalk.red('Error:'), message);
  process.exit(1);
}

async function handleAttachmentsList(pageId: string, options: {
  limit?: string; pattern?: string; download?: boolean;
  dest?: string; format?: string;
}, analytics: Analytics): Promise<void> {
  const config = getConfig();
  const client = buildAttachmentsClient(config);

  const maxResults = options.limit ? Number.parseInt(options.limit, 10) : undefined;
  if (options.limit && (Number.isNaN(maxResults) || maxResults! <= 0)) {
    throw new Error('Limit must be a positive number.');
  }

  const format = (options.format ?? 'text').toLowerCase();
  if (!['text', 'json'].includes(format)) {
    throw new Error('Format must be one of: text, json');
  }

  const attachments = await client.getAll(pageId, { maxResults });
  const pattern = options.pattern?.trim();
  const filtered = pattern
    ? attachments.filter((att) => client.matchesPattern(att.title, pattern))
    : attachments;

  if (filtered.length === 0) {
    if (format === 'json') {
      console.log(JSON.stringify({ attachmentCount: 0, attachments: [] }, null, 2));
    } else {
      console.log(chalk.yellow('No attachments found.'));
    }
    analytics.track('attachments', true);
    return;
  }

  if (format === 'json' && !options.download) {
    const output = {
      attachmentCount: filtered.length,
      attachments: filtered.map((att) => ({
        id: att.id,
        title: att.title,
        mediaType: att.mediaType ?? '',
        fileSize: att.fileSize,
        fileSizeFormatted: att.fileSize
          ? `${Math.max(1, Math.round(att.fileSize / 1024))} KB`
          : 'unknown size',
        version: att.version,
        downloadLink: att.downloadLink,
      })),
    };
    console.log(JSON.stringify(output, null, 2));
  } else if (!options.download) {
    console.log(
      chalk.blue(`Found ${filtered.length} attachment${filtered.length === 1 ? '' : 's'}:`),
    );
    for (let i = 0; i < filtered.length; i++) {
      const att = filtered[i]!;
      const sizeKb = att.fileSize
        ? `${Math.max(1, Math.round(att.fileSize / 1024))} KB`
        : 'unknown size';
      const typeLabel = att.mediaType ?? 'unknown';
      console.log(`${i + 1}. ${chalk.green(att.title)} (ID: ${att.id})`);
      console.log(
        `   Type: ${chalk.gray(typeLabel)} \u2022 Size: ${chalk.gray(sizeKb)} \u2022 Version: ${chalk.gray(att.version)}`,
      );
    }
  }

  if (options.download) {
    const destDir = path.resolve(options.dest ?? '.');
    fs.mkdirSync(destDir, { recursive: true });

    const downloadResults: Array<{ title: string; id: string; savedTo: string }> = [];
    for (const att of filtered) {
      const targetPath = uniquePathFor(destDir, att.title);
      await client.download(pageId, att.downloadLink, targetPath);
      downloadResults.push({ title: att.title, id: att.id, savedTo: targetPath });
      if (format !== 'json') {
        console.log(`  ${chalk.green(att.title)} -> ${chalk.gray(targetPath)}`);
      }
    }

    if (format === 'json') {
      console.log(JSON.stringify({
        attachmentCount: filtered.length,
        downloaded: downloadResults.length,
        destination: destDir,
        attachments: downloadResults,
      }, null, 2));
    } else {
      console.log(
        chalk.green(
          `Downloaded ${downloadResults.length} attachment${downloadResults.length === 1 ? '' : 's'} to ${destDir}`,
        ),
      );
    }
  }

  analytics.track('attachments', true);
}

async function handleAttachmentUpload(pageId: string, options: {
  file: string[]; comment?: string; replace?: boolean; minorEdit?: boolean;
}, analytics: Analytics): Promise<void> {
  const files = Array.isArray(options.file) ? options.file.filter(Boolean) : [];
  if (files.length === 0) {
    throw new Error('At least one --file option is required.');
  }

  const config = getConfig();
  assertWritable(config);
  const client = buildAttachmentsClient(config);

  const resolvedFiles = files.map((filePath) => ({
    original: filePath,
    resolved: path.resolve(filePath),
  }));

  for (const file of resolvedFiles) {
    if (!fs.existsSync(file.resolved)) {
      throw new Error(`File not found: ${file.original}`);
    }
  }

  let uploaded = 0;
  for (const file of resolvedFiles) {
    const result = await client.upload(pageId, file.resolved, {
      comment: options.comment,
      replace: options.replace,
      minorEdit: options.minorEdit,
    });
    console.log(
      `  ${chalk.green(result.title)} (ID: ${result.id}, Version: ${result.version})`,
    );
    uploaded++;
  }

  console.log(
    chalk.green(
      `Uploaded ${uploaded} attachment${uploaded === 1 ? '' : 's'} to page ${pageId}`,
    ),
  );
  analytics.track('attachment_upload', true);
}

async function handleAttachmentDelete(pageId: string, attachmentId: string, options: { yes?: boolean }, analytics: Analytics): Promise<void> {
  const config = getConfig();
  assertWritable(config);
  const client = buildAttachmentsClient(config);

  if (!options.yes) {
    const { confirmed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmed',
      default: false,
      message: `Delete attachment ${attachmentId} from page ${pageId}?`,
    }]);
    if (!confirmed) {
      console.log(chalk.yellow('Cancelled.'));
      analytics.track('attachment_delete_cancel', true);
      return;
    }
  }

  await client.delete(pageId, attachmentId);
  console.log(chalk.green('Attachment deleted successfully!'));
  console.log(`ID: ${chalk.blue(attachmentId)}`);
  console.log(`Page ID: ${chalk.blue(pageId)}`);
  analytics.track('attachment_delete', true);
}

export function registerAttachmentCommands(program: Command): void {
  // attachments - list/download
  program
    .command('attachments <pageId>')
    .description('List or download attachments for a page')
    .option('-l, --limit <limit>', 'Maximum number of attachments to fetch (default: all)')
    .option('-p, --pattern <glob>', 'Filter attachments by filename (e.g., "*.png")')
    .option('-d, --download', 'Download matching attachments')
    .option('--dest <directory>', 'Directory to save downloads (default: current directory)', '.')
    .option('-f, --format <format>', 'Output format (text, json)', 'text')
    .action(async (pageId: string, options: {
      limit?: string; pattern?: string; download?: boolean;
      dest?: string; format?: string;
    }) => {
      const analytics = new Analytics();
      try {
        await handleAttachmentsList(pageId, options, analytics);
      } catch (error) {
        handleCommandError(analytics, 'attachments', error);
      }
    });

  // attachment-upload
  program
    .command('attachment-upload <pageId>')
    .description('Upload one or more attachments to a page')
    .option(
      '-f, --file <file>',
      'File to upload (repeatable)',
      (value: string, previous: string[]) => {
        const files = Array.isArray(previous) ? previous : [];
        files.push(value);
        return files;
      },
      [] as string[],
    )
    .option('--comment <comment>', 'Comment for the attachment(s)')
    .option('--replace', 'Replace an existing attachment with the same filename')
    .option('--minor-edit', 'Mark the upload as a minor edit')
    .action(async (pageId: string, options: {
      file: string[]; comment?: string; replace?: boolean; minorEdit?: boolean;
    }) => {
      const analytics = new Analytics();
      try {
        await handleAttachmentUpload(pageId, options, analytics);
      } catch (error) {
        handleCommandError(analytics, 'attachment_upload', error);
      }
    });

  // attachment-delete
  program
    .command('attachment-delete <pageId> <attachmentId>')
    .description('Delete an attachment by ID from a page')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (pageId: string, attachmentId: string, options: { yes?: boolean }) => {
      const analytics = new Analytics();
      try {
        await handleAttachmentDelete(pageId, attachmentId, options, analytics);
      } catch (error) {
        handleCommandError(analytics, 'attachment_delete', error);
      }
    });

  // --- Grouped subcommands (Rust CLI convention) ---

  const attachment = program
    .command('attachment')
    .description('Attachment operations (grouped)');

  attachment
    .command('list <pageId>')
    .description('List attachments for a page (alias: attachments)')
    .option('-l, --limit <limit>', 'Maximum number of attachments to fetch (default: all)')
    .option('-p, --pattern <glob>', 'Filter attachments by filename (e.g., "*.png")')
    .option('-f, --format <format>', 'Output format (text, json)', 'text')
    .action(async (pageId: string, options: {
      limit?: string; pattern?: string; format?: string;
    }) => {
      const analytics = new Analytics();
      try {
        await handleAttachmentsList(pageId, options, analytics);
      } catch (error) {
        handleCommandError(analytics, 'attachment_list', error);
      }
    });

  attachment
    .command('upload <pageId>')
    .description('Upload attachments to a page (alias: attachment-upload)')
    .option(
      '-f, --file <file>',
      'File to upload (repeatable)',
      (value: string, previous: string[]) => {
        const files = Array.isArray(previous) ? previous : [];
        files.push(value);
        return files;
      },
      [] as string[],
    )
    .option('--comment <comment>', 'Comment for the attachment(s)')
    .option('--replace', 'Replace an existing attachment with the same filename')
    .option('--minor-edit', 'Mark the upload as a minor edit')
    .action(async (pageId: string, options: {
      file: string[]; comment?: string; replace?: boolean; minorEdit?: boolean;
    }) => {
      const analytics = new Analytics();
      try {
        await handleAttachmentUpload(pageId, options, analytics);
      } catch (error) {
        handleCommandError(analytics, 'attachment_upload_grouped', error);
      }
    });

  attachment
    .command('download <pageId>')
    .description('Download attachments from a page (alias: attachments --download)')
    .option('-p, --pattern <glob>', 'Filter attachments by filename (e.g., "*.png")')
    .option('--dest <directory>', 'Directory to save downloads (default: current directory)', '.')
    .option('-l, --limit <limit>', 'Maximum number of attachments to fetch (default: all)')
    .option('-f, --format <format>', 'Output format (text, json)', 'text')
    .action(async (pageId: string, options: {
      pattern?: string; dest?: string; limit?: string; format?: string;
    }) => {
      const analytics = new Analytics();
      try {
        await handleAttachmentsList(pageId, { ...options, download: true }, analytics);
      } catch (error) {
        handleCommandError(analytics, 'attachment_download', error);
      }
    });

  attachment
    .command('delete <pageId> <attachmentId>')
    .description('Delete an attachment by ID (alias: attachment-delete)')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (pageId: string, attachmentId: string, options: { yes?: boolean }) => {
      const analytics = new Analytics();
      try {
        await handleAttachmentDelete(pageId, attachmentId, options, analytics);
      } catch (error) {
        handleCommandError(analytics, 'attachment_group_delete', error);
      }
    });
}
