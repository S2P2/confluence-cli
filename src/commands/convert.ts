import type { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import { Analytics } from '../analytics.js';
import { handleCommandError } from './helpers.js';

const VALID_INPUT_FORMATS = ['markdown', 'storage', 'html'];
const VALID_OUTPUT_FORMATS = ['markdown', 'storage', 'html', 'text'];

/**
 * Strip HTML tags and decode entities to plain text.
 */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convert Confluence storage format (XHTML-based) to approximate Markdown.
 * This is a local-only conversion without server roundtrip.
 */
function storageToMarkdown(storage: string): string {
  let md = storage;
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');
  md = md.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n');
  md = md.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n');
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
  md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
  md = md.replace(/<hr\s*\/?>/gi, '---\n\n');
  md = md.replace(/<[^>]+>/g, '');
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");
  md = md.replace(/\n{3,}/g, '\n\n');
  return md.trim();
}

/**
 * Convert Markdown to approximate Confluence storage format.
 */
function markdownToStorage(markdown: string): string {
  let storage = markdown;
  storage = storage.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  storage = storage.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  storage = storage.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  storage = storage.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  storage = storage.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  storage = storage.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
  storage = storage.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  storage = storage.replace(/\*(.+?)\*/g, '<em>$1</em>');
  storage = storage.replace(/`(.+?)`/g, '<code>$1</code>');
  storage = storage.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  storage = storage.replace(/^---$/gm, '<hr/>');
  storage = storage.replace(/\n{2,}/g, '</p><p>');
  return `<p>${storage}</p>`;
}

/**
 * Convert Markdown to HTML.
 */
function markdownToHtml(markdown: string): string {
  let html = markdown;
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/^---$/gm, '<hr/>');
  html = html.replace(/\n{2,}/g, '</p><p>');
  html = html.replace(/\n/g, '<br/>');
  return `<p>${html}</p>`;
}

/**
 * Convert HTML to Confluence storage format (identity + cleanup).
 */
function htmlToStorage(html: string): string {
  return html;
}

function convert(input: string, inputFormat: string, outputFormat: string): string {
  if (inputFormat === 'markdown' && outputFormat === 'storage') {
    return markdownToStorage(input);
  }
  if (inputFormat === 'markdown' && outputFormat === 'html') {
    return markdownToHtml(input);
  }
  if (inputFormat === 'markdown' && outputFormat === 'text') {
    return htmlToPlainText(markdownToHtml(input));
  }
  if (inputFormat === 'html' && outputFormat === 'storage') {
    return htmlToStorage(input);
  }
  if (inputFormat === 'html' && outputFormat === 'markdown') {
    return storageToMarkdown(input);
  }
  if (inputFormat === 'html' && outputFormat === 'text') {
    return htmlToPlainText(input);
  }
  if (inputFormat === 'storage' && outputFormat === 'markdown') {
    return storageToMarkdown(input);
  }
  if (inputFormat === 'storage' && outputFormat === 'html') {
    return input;
  }
  if (inputFormat === 'storage' && outputFormat === 'text') {
    return htmlToPlainText(input);
  }
  throw new Error(
    `Conversion from "${inputFormat}" to "${outputFormat}" is not supported.`,
  );
}

export function registerConvertCommand(program: Command): void {
  program
    .command('convert')
    .description('Convert between content formats locally (no server connection required)')
    .option('-i, --input-file <file>', 'Input file path (reads from stdin if omitted)')
    .option('-o, --output-file <file>', 'Output file path (writes to stdout if omitted)')
    .option('--input-format <format>', `Input format (${VALID_INPUT_FORMATS.join(', ')})`)
    .option('--output-format <format>', `Output format (${VALID_OUTPUT_FORMATS.join(', ')})`)
    .action(async (options: {
      inputFile?: string; outputFile?: string;
      inputFormat?: string; outputFormat?: string;
    }) => {
      const analytics = new Analytics();
      try {
        if (!options.inputFormat) {
          console.error(chalk.red('Error: --input-format is required.'));
          process.exit(1);
        }
        if (!options.outputFormat) {
          console.error(chalk.red('Error: --output-format is required.'));
          process.exit(1);
        }
        if (!VALID_INPUT_FORMATS.includes(options.inputFormat)) {
          console.error(
            chalk.red(
              `Error: Invalid input format "${options.inputFormat}". Valid: ${VALID_INPUT_FORMATS.join(', ')}`,
            ),
          );
          process.exit(1);
        }
        if (!VALID_OUTPUT_FORMATS.includes(options.outputFormat)) {
          console.error(
            chalk.red(
              `Error: Invalid output format "${options.outputFormat}". Valid: ${VALID_OUTPUT_FORMATS.join(', ')}`,
            ),
          );
          process.exit(1);
        }
        if (options.inputFormat === options.outputFormat) {
          console.error(chalk.red('Error: Input and output formats must be different.'));
          process.exit(1);
        }

        let input: string;
        if (options.inputFile) {
          input = fs.readFileSync(options.inputFile, 'utf-8');
        } else {
          input = fs.readFileSync(process.stdin.fd, 'utf-8');
        }

        const output = convert(input, options.inputFormat, options.outputFormat);

        if (options.outputFile) {
          fs.writeFileSync(options.outputFile, output, 'utf-8');
          console.error(
            chalk.green(`Converted ${options.inputFormat} -> ${options.outputFormat}: ${options.outputFile}`),
          );
        } else {
          process.stdout.write(output);
        }

        analytics.track('convert', true);
      } catch (error) {
        handleCommandError(analytics, 'convert', error);
      }
    });
}
