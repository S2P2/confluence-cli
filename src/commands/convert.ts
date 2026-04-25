import type { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import { Analytics } from '../analytics.js';
import { handleCommandError } from './helpers.js';
import { htmlToMarkdown, htmlToPlainText, markdownToStorage, markdownToHtml } from '../utils/convert.js';

const VALID_INPUT_FORMATS = ['markdown', 'storage', 'html'];
const VALID_OUTPUT_FORMATS = ['markdown', 'storage', 'html', 'text'];

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
    return input;
  }
  if (inputFormat === 'html' && outputFormat === 'markdown') {
    return htmlToMarkdown(input);
  }
  if (inputFormat === 'html' && outputFormat === 'text') {
    return htmlToPlainText(input);
  }
  if (inputFormat === 'storage' && outputFormat === 'markdown') {
    return htmlToMarkdown(input);
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
