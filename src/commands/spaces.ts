import type { Command } from 'commander';
import chalk from 'chalk';
import { HttpClient } from '../client/http.js';
import { DefaultSpacesClient } from '../client/spaces.js';
import { getConfig } from '../config/loader.js';
import { Analytics } from '../analytics.js';
import { formatSpaces } from '../format/output.js';

function buildSpacesClient(config: ReturnType<typeof getConfig>): DefaultSpacesClient {
  const http = new HttpClient(config);
  return new DefaultSpacesClient(http);
}

function handleCommandError(analytics: Analytics, commandName: string, error: unknown): never {
  analytics.track(commandName, false);
  const message = error instanceof Error ? error.message : String(error);
  console.error(chalk.red('Error:'), message);
  process.exit(1);
}

export function registerSpaceCommands(program: Command): void {
  // spaces - list
  program
    .command('spaces')
    .description('List all Confluence spaces')
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

  // space get
  const spaceCmd = program.command('space').description('Space operations');

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
}
