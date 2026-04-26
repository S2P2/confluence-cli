import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import chalk from 'chalk'

const STATS_DIR = path.join(os.homedir(), '.confluence-cli')
const STATS_FILE = path.join(STATS_DIR, 'stats.json')

interface CommandStats {
  count: number
  lastUsed: string
  successes: number
  failures: number
}

interface StatsData {
  commands: Record<string, CommandStats>
}

export class Analytics {
  private data: StatsData

  constructor() {
    this.data = this.loadStats()
  }

  public track(command: string, success: boolean): void {
    if (process.env.CONFLUENCE_CLI_ANALYTICS === 'false') return

    if (!this.data.commands[command]) {
      this.data.commands[command] = { count: 0, lastUsed: '', successes: 0, failures: 0 }
    }

    const entry = this.data.commands[command]
    entry.count += 1
    entry.lastUsed = new Date().toISOString()
    if (success) {
      entry.successes += 1
    } else {
      entry.failures += 1
    }

    this.saveStats()
  }

  public showStats(): void {
    const entries = Object.entries(this.data.commands)
    if (entries.length === 0) {
      console.log(chalk.yellow('No usage statistics available.'))
      return
    }

    console.log(chalk.blue('Usage Statistics:'))
    entries
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([cmd, stats]) => {
        console.log(`  ${chalk.green(cmd)}: ${stats.count} uses (${stats.successes} ok, ${stats.failures} fail)`)
      })
  }

  private loadStats(): StatsData {
    try {
      if (fs.existsSync(STATS_FILE)) {
        const raw = fs.readFileSync(STATS_FILE, 'utf-8')
        return JSON.parse(raw) as StatsData
      }
    } catch {
      // Silently ignore
    }
    return { commands: {} }
  }

  private saveStats(): void {
    try {
      if (!fs.existsSync(STATS_DIR)) {
        fs.mkdirSync(STATS_DIR, { recursive: true })
      }
      fs.writeFileSync(STATS_FILE, JSON.stringify(this.data, null, 2))
    } catch {
      // Silently ignore
    }
  }
}
