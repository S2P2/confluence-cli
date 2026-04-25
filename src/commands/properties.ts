import type { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import inquirer from 'inquirer';
import { HttpClient } from '../client/http.js';
import { DefaultPropertiesClient } from '../client/properties.js';
import { getConfig } from '../config/loader.js';
import { Analytics } from '../analytics.js';

function assertWritable(config: { readOnly: boolean }): void {
  if (config.readOnly) {
    console.error(
      chalk.red('Error: This profile is in read-only mode. Write operations are not allowed.'),
    );
    process.exit(1);
  }
}

function buildPropertiesClient(config: ReturnType<typeof getConfig>): DefaultPropertiesClient {
  const http = new HttpClient(config);
  return new DefaultPropertiesClient(http);
}

function handleCommandError(analytics: Analytics, commandName: string, error: unknown): never {
  analytics.track(commandName, false);
  const message = error instanceof Error ? error.message : String(error);
  console.error(chalk.red('Error:'), message);
  process.exit(1);
}

export function registerPropertyCommands(program: Command): void {
  // property-list
  program
    .command('property-list <pageId>')
    .description('List all content properties for a page')
    .option('-f, --format <format>', 'Output format (text, json)', 'text')
    .option('-l, --limit <limit>', 'Maximum number of properties to fetch (default: 25)')
    .option('--start <start>', 'Start index for results (default: 0)', '0')
    .option('--all', 'Fetch all properties (ignores pagination)')
    .action(async (pageId: string, options: {
      format?: string; limit?: string; start?: string; all?: boolean;
    }) => {
      const analytics = new Analytics();
      try {
        await handlePropertyList(pageId, options, analytics);
      } catch (error) {
        handleCommandError(analytics, 'property_list', error);
      }
    });

  // property-get
  program
    .command('property-get <pageId> <key>')
    .description('Get a content property by key')
    .option('-f, --format <format>', 'Output format (text, json)', 'text')
    .action(async (pageId: string, key: string, options: { format?: string }) => {
      const analytics = new Analytics();
      try {
        await handlePropertyGet(pageId, key, options, analytics);
      } catch (error) {
        handleCommandError(analytics, 'property_get', error);
      }
    });

  // property-set
  program
    .command('property-set <pageId> <key>')
    .description('Set a content property (create or update)')
    .option('-v, --value <json>', 'Property value as JSON')
    .option('--file <file>', 'Read property value from a JSON file')
    .option('-f, --format <format>', 'Output format (text, json)', 'text')
    .action(async (pageId: string, key: string, options: {
      value?: string; file?: string; format?: string;
    }) => {
      const analytics = new Analytics();
      try {
        await handlePropertySet(pageId, key, options, analytics);
      } catch (error) {
        handleCommandError(analytics, 'property_set', error);
      }
    });

  // property-delete
  program
    .command('property-delete <pageId> <key>')
    .description('Delete a content property by key')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (pageId: string, key: string, options: { yes?: boolean }) => {
      const analytics = new Analytics();
      try {
        await handlePropertyDelete(pageId, key, options, analytics);
      } catch (error) {
        handleCommandError(analytics, 'property_delete', error);
      }
    });

  // --- Grouped subcommands (Rust CLI convention) ---

  const property = program
    .command('property')
    .description('Property operations (grouped)');

  property
    .command('list <pageId>')
    .description('List all content properties for a page (alias: property-list)')
    .option('-f, --format <format>', 'Output format (text, json)', 'text')
    .option('-l, --limit <limit>', 'Maximum number of properties to fetch (default: 25)')
    .option('--start <start>', 'Start index for results (default: 0)', '0')
    .option('--all', 'Fetch all properties (ignores pagination)')
    .action(async (pageId: string, options: {
      format?: string; limit?: string; start?: string; all?: boolean;
    }) => {
      const analytics = new Analytics();
      try {
        await handlePropertyList(pageId, options, analytics);
      } catch (error) {
        handleCommandError(analytics, 'property_group_list', error);
      }
    });

  property
    .command('get <pageId> <key>')
    .description('Get a content property by key (alias: property-get)')
    .option('-f, --format <format>', 'Output format (text, json)', 'text')
    .action(async (pageId: string, key: string, options: { format?: string }) => {
      const analytics = new Analytics();
      try {
        await handlePropertyGet(pageId, key, options, analytics);
      } catch (error) {
        handleCommandError(analytics, 'property_group_get', error);
      }
    });

  property
    .command('set <pageId> <key>')
    .description('Set a content property (alias: property-set)')
    .option('-v, --value <json>', 'Property value as JSON')
    .option('--file <file>', 'Read property value from a JSON file')
    .option('-f, --format <format>', 'Output format (text, json)', 'text')
    .action(async (pageId: string, key: string, options: {
      value?: string; file?: string; format?: string;
    }) => {
      const analytics = new Analytics();
      try {
        await handlePropertySet(pageId, key, options, analytics);
      } catch (error) {
        handleCommandError(analytics, 'property_group_set', error);
      }
    });

  property
    .command('delete <pageId> <key>')
    .description('Delete a content property by key (alias: property-delete)')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (pageId: string, key: string, options: { yes?: boolean }) => {
      const analytics = new Analytics();
      try {
        await handlePropertyDelete(pageId, key, options, analytics);
      } catch (error) {
        handleCommandError(analytics, 'property_group_delete', error);
      }
    });
}

function parseNextStart(links: { next?: string } | undefined): number | undefined {
  if (!links?.next) return undefined;
  const url = typeof links.next === 'string' ? links.next : '';
  const match = url.match(/[?&]start=(\d+)/);
  return match?.[1] ? Number(match[1]) : undefined;
}

async function handlePropertyList(pageId: string, options: {
  format?: string; limit?: string; start?: string; all?: boolean;
}, analytics: Analytics): Promise<void> {
  const config = getConfig();
  const client = buildPropertiesClient(config);

  const format = (options.format ?? 'text').toLowerCase();
  if (!['text', 'json'].includes(format)) {
    throw new Error('Format must be one of: text, json');
  }

  const limit = options.limit ? Number.parseInt(options.limit, 10) : undefined;
  if (options.limit && (Number.isNaN(limit) || limit! <= 0)) {
    throw new Error('Limit must be a positive number.');
  }

  const start = options.start ? Number.parseInt(options.start, 10) : 0;
  if (options.start && (Number.isNaN(start) || start < 0)) {
    throw new Error('Start must be a non-negative number.');
  }

  let properties: import('../client/types.js').ContentProperty[];
  let nextStart: number | undefined;

  if (options.all) {
    properties = await client.getAll(pageId, {
      maxResults: limit,
      start,
    });
  } else {
    const response = await client.list(pageId, {
      limit,
      start,
    });
    properties = response.results;
    nextStart = parseNextStart(response._links);
  }

  if (format === 'json') {
    const output: { properties: typeof properties; nextStart?: number } = { properties };
    if (!options.all) output.nextStart = nextStart;
    console.log(JSON.stringify(output, null, 2));
  } else if (properties.length === 0) {
    console.log(chalk.yellow('No properties found.'));
  } else {
    for (let i = 0; i < properties.length; i++) {
      const prop = properties[i]!;
      const preview = JSON.stringify(prop.value);
      const truncated = preview.length > 80
        ? `${preview.slice(0, 77)}...`
        : preview;
      console.log(
        `${chalk.blue(`${i + 1}.`)} ${chalk.green(prop.key)} (v${prop.version.number}): ${truncated}`,
      );
    }
    if (!options.all && nextStart != null) {
      console.log(chalk.gray(`Next start: ${nextStart}`));
    }
  }

  analytics.track('property_list', true);
}

async function handlePropertyGet(pageId: string, key: string, options: { format?: string }, analytics: Analytics): Promise<void> {
  const config = getConfig();
  const client = buildPropertiesClient(config);

  const format = (options.format ?? 'text').toLowerCase();
  if (!['text', 'json'].includes(format)) {
    throw new Error('Format must be one of: text, json');
  }

  const property = await client.get(pageId, key);

  if (format === 'json') {
    console.log(JSON.stringify(property, null, 2));
  } else {
    console.log(`${chalk.green('Key:')} ${property.key}`);
    console.log(`${chalk.green('Version:')} ${property.version.number}`);
    console.log(`${chalk.green('Value:')}`);
    console.log(JSON.stringify(property.value, null, 2));
  }
  analytics.track('property_get', true);
}

async function handlePropertySet(pageId: string, key: string, options: {
  value?: string; file?: string; format?: string;
}, analytics: Analytics): Promise<void> {
  const config = getConfig();
  assertWritable(config);
  const client = buildPropertiesClient(config);

  if (!options.value && !options.file) {
    throw new Error('Provide a value with --value or --file.');
  }

  let value: unknown;
  if (options.file) {
    const raw = fs.readFileSync(options.file, 'utf-8');
    try {
      value = JSON.parse(raw);
    } catch {
      throw new Error(`Invalid JSON in file ${options.file}`);
    }
  } else {
    try {
      value = JSON.parse(options.value!);
    } catch {
      throw new Error('Invalid JSON in --value');
    }
  }

  const format = (options.format ?? 'text').toLowerCase();
  if (!['text', 'json'].includes(format)) {
    throw new Error('Format must be one of: text, json');
  }

  const result = await client.set(pageId, key, value);

  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(chalk.green('Property set successfully!'));
    console.log(`${chalk.green('Key:')} ${result.key}`);
    console.log(`${chalk.green('Version:')} ${result.version.number}`);
    console.log(`${chalk.green('Value:')}`);
    console.log(JSON.stringify(result.value, null, 2));
  }
  analytics.track('property_set', true);
}

async function handlePropertyDelete(pageId: string, key: string, options: { yes?: boolean }, analytics: Analytics): Promise<void> {
  const config = getConfig();
  assertWritable(config);
  const client = buildPropertiesClient(config);

  if (!options.yes) {
    const { confirmed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmed',
      default: false,
      message: `Delete property "${key}" from page ${pageId}?`,
    }]);
    if (!confirmed) {
      console.log(chalk.yellow('Cancelled.'));
      analytics.track('property_delete_cancel', true);
      return;
    }
  }

  await client.delete(pageId, key);
  console.log(chalk.green('Property deleted successfully!'));
  console.log(`${chalk.green('Key:')} ${chalk.blue(key)}`);
  console.log(`${chalk.green('Page ID:')} ${chalk.blue(pageId)}`);
  analytics.track('property_delete', true);
}
