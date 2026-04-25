import type { Command } from 'commander';
import chalk from 'chalk';
import { HttpClient } from '../client/http.js';
import { DefaultSpacesClient } from '../client/spaces.js';
import { getConfig } from '../config/loader.js';
import { Analytics } from '../analytics.js';
import { formatSpaces } from '../format/output.js';
import { handleCommandError } from './helpers.js';

function buildSpacesClient(config: ReturnType<typeof getConfig>): DefaultSpacesClient {
  const http = new HttpClient(config);
  return new DefaultSpacesClient(http);
}

export function registerSpaceCommands(program: Command): void {
  // space group (matches Rust CLI convention: space list, space get)
  const spaceCmd = program.command('space').description('Space operations');

  spaceCmd
    .command('list')
    .description('List all Confluence spaces')
    .option('--json', 'Output as JSON')
    .action(async (options: { json?: boolean }) => {
      const analytics = new Analytics();
      try {
        const config = getConfig();
        const client = buildSpacesClient(config);
        const spaces = await client.list();

        if (options.json) {
          console.log(JSON.stringify(spaces, null, 2));
        } else {
          console.log(formatSpaces(spaces));
        }
        analytics.track('space_list', true);
      } catch (error) {
        handleCommandError(analytics, 'space_list', error);
      }
    });

  spaceCmd
    .command('get <key>')
    .description('Get space details')
    .option('--json', 'Output as JSON')
    .action(async (key: string, options: { json?: boolean }) => {
      const analytics = new Analytics();
      try {
        const config = getConfig();
        const client = buildSpacesClient(config);
        const space = await client.get(key);

        if (options.json) {
          console.log(JSON.stringify(space, null, 2));
        } else {
          console.log(chalk.blue('Space Information:'));
          console.log(`Key: ${chalk.green(space.key)}`);
          console.log(`Name: ${chalk.green(space.name)}`);
          console.log(`Type: ${chalk.green(space.type)}`);
          console.log(`Status: ${chalk.green(space.status)}`);
          if (space.id) console.log(`ID: ${chalk.green(space.id)}`);
        }
        analytics.track('space_get', true);
      } catch (error) {
        handleCommandError(analytics, 'space_get', error);
      }
    });

  // Keep 'spaces' as alias for backward compat with JS CLI
  program
    .command('spaces')
    .description('List all Confluence spaces (alias for space list)')
    .action(async () => {
      const analytics = new Analytics();
      try {
        const config = getConfig();
        const client = buildSpacesClient(config);
        const spaces = await client.list();

        console.log(formatSpaces(spaces));
        analytics.track('spaces', true);
      } catch (error) {
        handleCommandError(analytics, 'spaces', error);
      }
    });
}
