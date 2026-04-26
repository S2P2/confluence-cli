import chalk from 'chalk'
import type { Analytics } from '../analytics.js'

export function assertWritable(config: { readOnly: boolean }): void {
  if (config.readOnly) {
    console.error(chalk.red('Error: This profile is in read-only mode. Write operations are not allowed.'))
    process.exit(1)
  }
}

export function handleCommandError(analytics: Analytics, commandName: string, error: unknown): never {
  analytics.track(commandName, false)
  const message = error instanceof Error ? error.message : String(error)
  console.error(chalk.red('Error:'), message)
  process.exit(1)
}
