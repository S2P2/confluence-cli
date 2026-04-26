import chalk from 'chalk'
import type { Command } from 'commander'
import { Analytics } from '../analytics'
import { HttpClient } from '../client/http'
import { DefaultLabelsClient } from '../client/labels'
import { getConfig } from '../config'
import { formatJson } from '../format/output'

export function registerLabelCommands(program: Command): void {
  const label = program.command('label').description('Label operations')

  label
    .command('list <pageId>')
    .description('List labels on a page')
    .option('--json', 'Output as JSON')
    .action(async (pageId: string, options: { json?: boolean }) => {
      const analytics = new Analytics()
      try {
        const client = new DefaultLabelsClient(new HttpClient(getConfig()))
        const labels = await client.list(pageId)
        if (options.json) {
          console.log(formatJson(labels))
        } else {
          if (labels.length === 0) {
            console.log(chalk.yellow('No labels found.'))
            return
          }
          console.log(chalk.blue(`Labels (${labels.length}):`))
          for (const lbl of labels) {
            console.log(`  ${chalk.green(lbl.name)} ${chalk.gray(`[${lbl.prefix}]`)}`)
          }
        }
        analytics.track('label_list', true)
      } catch (error) {
        analytics.track('label_list', false)
        console.error(chalk.red('Error:'), (error as Error).message)
        process.exit(1)
      }
    })

  label
    .command('add <pageId> <name>')
    .description('Add a label to a page')
    .action(async (pageId: string, name: string) => {
      const analytics = new Analytics()
      try {
        const client = new DefaultLabelsClient(new HttpClient(getConfig()))
        await client.add(pageId, name)
        console.log(chalk.green(`Label "${name}" added to page ${pageId}.`))
        analytics.track('label_add', true)
      } catch (error) {
        analytics.track('label_add', false)
        console.error(chalk.red('Error:'), (error as Error).message)
        process.exit(1)
      }
    })

  label
    .command('delete <pageId> <name>')
    .description('Delete a label from a page')
    .action(async (pageId: string, name: string) => {
      const analytics = new Analytics()
      try {
        const client = new DefaultLabelsClient(new HttpClient(getConfig()))
        await client.remove(pageId, name)
        console.log(chalk.green(`Label "${name}" deleted from page ${pageId}.`))
        analytics.track('label_delete', true)
      } catch (error) {
        analytics.track('label_delete', false)
        console.error(chalk.red('Error:'), (error as Error).message)
        process.exit(1)
      }
    })
}
