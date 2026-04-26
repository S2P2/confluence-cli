import { Command } from 'commander';
import { registerPageCommands } from './commands/pages';
import { registerBlogCommands } from './commands/blog';
import { registerLabelCommands } from './commands/labels';
import { registerCommentCommands } from './commands/comments';
import { registerAttachmentCommands } from './commands/attachments';
import { registerPropertyCommands } from './commands/properties';
import { registerSearchCommand } from './commands/search';
import { registerSpaceCommands } from './commands/spaces';
import { registerDoctorCommand } from './commands/doctor';
import { registerProfileCommands } from './commands/profile';
import { registerConvertCommand } from './commands/convert';
import { initConfig } from './config';
import { Analytics } from './analytics';
import chalk from 'chalk';
import pkg from '../package.json';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('confluence')
    .description('CLI tool for Atlassian Confluence')
    .version(pkg.version)
    .option('--profile <name>', 'Use a specific configuration profile');

  // Init command
  program
    .command('init')
    .description('Initialize Confluence CLI configuration')
    .option('-d, --domain <domain>', 'Confluence domain')
    .option('--protocol <protocol>', 'Protocol (http or https)')
    .option('-p, --api-path <path>', 'REST API path')
    .option('-a, --auth-type <type>', 'Authentication type (basic, bearer, mtls, cookie)')
    .option('-e, --email <email>', 'Email or username for basic auth')
    .option('-t, --token <token>', 'API token')
    .option('-c, --cookie <cookie>', 'Cookie for Enterprise SSO')
    .option('--tls-ca-cert <path>', 'CA certificate for mTLS')
    .option('--tls-client-cert <path>', 'Client certificate for mTLS')
    .option('--tls-client-key <path>', 'Client private key for mTLS')
    .option('--read-only', 'Set profile to read-only mode')
    .action(async (options) => {
      const profile = program.opts().profile;
      await initConfig({ ...options, profile });
    });

  // Stats command
  program
    .command('stats')
    .description('Show usage statistics')
    .action(() => {
      new Analytics().showStats();
    });

  // Install-skill command (keep for backward compat)
  program
    .command('install-skill')
    .description('Copy Claude Code skill files into your project')
    .option('--dest <directory>', 'Target directory', './.claude/skills/confluence')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (options) => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const inquirer = (await import('inquirer')).default;

      const skillSrc = path.join(import.meta.dirname, '..', 'plugins', 'confluence', 'skills', 'confluence', 'SKILL.md');

      if (!fs.existsSync(skillSrc)) {
        console.error(chalk.red('Error: skill file not found in package.'));
        process.exit(1);
      }

      const destDir = path.resolve(options.dest);
      const destFile = path.join(destDir, 'SKILL.md');

      if (fs.existsSync(destFile) && !options.yes) {
        const { confirmed } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirmed',
          default: true,
          message: `Overwrite existing skill file at ${destFile}?`,
        }]);
        if (!confirmed) {
          console.log(chalk.yellow('Cancelled.'));
          return;
        }
      }

      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(skillSrc, destFile);

      console.log(chalk.green('Skill installed successfully!'));
      console.log(`Location: ${chalk.gray(destFile)}`);
    });

  // Register all command groups
  registerPageCommands(program);
  registerBlogCommands(program);
  registerLabelCommands(program);
  registerCommentCommands(program);
  registerAttachmentCommands(program);
  registerPropertyCommands(program);
  registerSearchCommand(program);
  registerSpaceCommands(program);
  registerDoctorCommand(program);
  registerProfileCommands(program);
  registerConvertCommand(program);

  return program;
}
