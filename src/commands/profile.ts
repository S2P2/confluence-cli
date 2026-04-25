import type { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { listProfiles, setActiveProfile, deleteProfile, isValidProfileName, initConfig } from '../config/profiles.js';
import { formatProfiles } from '../format/output.js';

export function registerProfileCommands(program: Command): void {
  const profileCmd = program
    .command('profile')
    .description('Manage configuration profiles');

  // profile list
  profileCmd
    .command('list')
    .description('List all configuration profiles')
    .action(() => {
      const { profiles } = listProfiles();
      if (profiles.length === 0) {
        console.log(
          chalk.yellow('No profiles configured. Run "confluence init" to create one.'),
        );
        return;
      }
      console.log(formatProfiles(profiles));
    });

  // profile use
  profileCmd
    .command('use <name>')
    .description('Set the active configuration profile')
    .action((name: string) => {
      try {
        setActiveProfile(name);
        console.log(chalk.green(`Switched to profile "${name}"`));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red('Error:'), message);
        process.exit(1);
      }
    });

  // profile add
  profileCmd
    .command('add <name>')
    .description('Add a new configuration profile interactively')
    .option('-d, --domain <domain>', 'Confluence domain')
    .option('--protocol <protocol>', 'Protocol (http or https)')
    .option('-p, --api-path <path>', 'REST API path')
    .option('-a, --auth-type <type>', 'Authentication type (basic, bearer, mtls, or cookie)')
    .option('-e, --email <email>', 'Email or username for basic auth')
    .option('-t, --token <token>', 'API token')
    .option('-c, --cookie <cookie>', 'Cookie for Enterprise SSO authentication')
    .option('--tls-ca-cert <path>', 'CA certificate for mTLS connections')
    .option('--tls-client-cert <path>', 'Client certificate for mTLS connections')
    .option('--tls-client-key <path>', 'Client private key for mTLS connections')
    .option('--read-only', 'Set profile to read-only mode (blocks write operations)')
    .action(async (name: string, options: {
      domain?: string; protocol?: string; apiPath?: string;
      authType?: string; email?: string; token?: string;
      cookie?: string; tlsCaCert?: string; tlsClientCert?: string;
      tlsClientKey?: string; readOnly?: boolean;
    }) => {
      if (!isValidProfileName(name)) {
        console.error(
          chalk.red('Invalid profile name. Use only letters, numbers, hyphens, and underscores.'),
        );
        process.exit(1);
      }
      await initConfig({ ...options, profile: name });
    });

  // profile remove
  profileCmd
    .command('remove <name>')
    .description('Remove a configuration profile')
    .action(async (name: string) => {
      try {
        const { confirmed } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirmed',
          message: `Delete profile "${name}"?`,
          default: false,
        }]);
        if (!confirmed) {
          console.log(chalk.yellow('Cancelled.'));
          return;
        }
        deleteProfile(name);
        console.log(chalk.green(`Profile "${name}" removed.`));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red('Error:'), message);
        process.exit(1);
      }
    });
}
