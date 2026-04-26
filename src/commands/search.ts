import chalk from 'chalk'
import type { Command } from 'commander'
import { Analytics } from '../analytics'
import { HttpClient } from '../client/http'
import { DefaultSearchClient } from '../client/search'
import { getConfig } from '../config'
import { formatJson, formatSearchResults } from '../format/output'

export function registerSearchCommand(program: Command): void {
  program
    .command('search <query>')
    .description('Search Confluence content')
    .option('-l, --limit <number>', 'Maximum number of results', '25')
    .option('--cql', 'Treat query as raw CQL instead of search terms')
    .option('--space <key>', 'Filter results to a specific space')
    .option('--type <type>', 'Filter by content type (page, blog)')
    .option('--json', 'Output as JSON')
    .action(
      async (
        query: string,
        options: {
          limit?: string
          cql?: boolean
          space?: string
          type?: string
          json?: boolean
        },
      ) => {
        const analytics = new Analytics()
        try {
          const client = new DefaultSearchClient(new HttpClient(getConfig()))
          const limit = options.limit ? parseInt(options.limit, 10) : 25
          const results = await client.search(query, {
            limit,
            rawCql: options.cql,
            space: options.space,
            type: options.type,
          })
          if (options.json) {
            console.log(formatJson(results))
          } else {
            console.log(formatSearchResults(results))
          }
          analytics.track('search', true)
        } catch (error) {
          analytics.track('search', false)
          console.error(chalk.red('Error:'), (error as Error).message)
          process.exit(1)
        }
      },
    )
}
