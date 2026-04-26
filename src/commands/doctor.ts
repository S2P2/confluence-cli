import fs from 'node:fs'
import chalk from 'chalk'
import type { Command } from 'commander'
import { Analytics } from '../analytics'
import { HttpClient } from '../client/http'
import { CONFIG_FILE, getConfig, loadConfig } from '../config'
import { formatJson } from '../format/output'

interface DoctorCheck {
  name: string
  status: 'pass' | 'fail' | 'warn'
  message: string
}

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Validate configuration, authentication, and connectivity')
    .option('--space <key>', 'Also verify access to a specific space')
    .option('--json', 'Output as JSON')
    .action(async (options: { space?: string; json?: boolean }) => {
      const analytics = new Analytics()
      const checks: DoctorCheck[] = []

      // 1. Config file exists
      checks.push(checkConfigFile())

      // If config file is missing, short-circuit
      const configFileCheck = checks[0]!
      if (configFileCheck.status === 'fail') {
        outputResults(checks, options.json ?? false)
        process.exit(1)
      }

      // 2. Active profile
      checks.push(checkActiveProfile())

      // 3. Auth credentials
      checks.push(checkAuthCredentials())

      // 4. Connectivity + token validity
      checks.push(await checkConnectivity())

      // 5. Space access (optional)
      if (options.space) {
        checks.push(await checkSpaceAccess(options.space))
      }

      const hasFailure = checks.some((c) => c.status === 'fail')
      outputResults(checks, options.json ?? false)
      analytics.track('doctor', !hasFailure)
      process.exit(hasFailure ? 1 : 0)
    })
}

function checkConfigFile(): DoctorCheck {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      loadConfig()
      return { name: 'Config file', status: 'pass', message: `Found at ${CONFIG_FILE}` }
    } catch (err) {
      return {
        name: 'Config file',
        status: 'fail',
        message: `Parse error: ${(err as Error).message}`,
      }
    }
  }
  return {
    name: 'Config file',
    status: 'fail',
    message: `Not found at ${CONFIG_FILE}. Run "confluence init" to create one.`,
  }
}

function checkActiveProfile(): DoctorCheck {
  try {
    const config = loadConfig()
    const profileName = config.activeProfile
    if (!config.profiles[profileName]) {
      return {
        name: 'Active profile',
        status: 'fail',
        message: `Profile "${profileName}" not found. Available: ${Object.keys(config.profiles).join(', ')}`,
      }
    }
    return { name: 'Active profile', status: 'pass', message: `Profile "${profileName}" is active` }
  } catch (err) {
    return { name: 'Active profile', status: 'fail', message: (err as Error).message }
  }
}

function checkAuthCredentials(): DoctorCheck {
  try {
    const resolved = getConfig()
    if (!resolved.token && resolved.authType !== 'mtls' && resolved.authType !== 'cookie') {
      return {
        name: 'Auth credentials',
        status: 'fail',
        message: `No token configured for ${resolved.authType} auth.`,
      }
    }
    if (resolved.authType === 'basic' && !resolved.email) {
      return {
        name: 'Auth credentials',
        status: 'fail',
        message: 'Basic auth requires an email address.',
      }
    }
    if (resolved.authType === 'cookie' && !resolved.cookie) {
      return {
        name: 'Auth credentials',
        status: 'fail',
        message: 'Cookie auth requires a cookie value.',
      }
    }
    return {
      name: 'Auth credentials',
      status: 'pass',
      message: `${resolved.authType} auth configured for ${resolved.domain}`,
    }
  } catch (err) {
    return { name: 'Auth credentials', status: 'fail', message: (err as Error).message }
  }
}

async function checkConnectivity(): Promise<DoctorCheck> {
  try {
    const config = getConfig()
    const httpClient = new HttpClient(config)
    await httpClient.get('/content', { limit: 1 })
    return {
      name: 'Connectivity',
      status: 'pass',
      message: `Connected to ${config.protocol}://${config.domain}`,
    }
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('401') || message.includes('403')) {
      return {
        name: 'Connectivity',
        status: 'fail',
        message: `Reached server but auth failed: ${message}`,
      }
    }
    return {
      name: 'Connectivity',
      status: 'fail',
      message: `Cannot reach server: ${message}`,
    }
  }
}

async function checkSpaceAccess(spaceKey: string): Promise<DoctorCheck> {
  try {
    const config = getConfig()
    const httpClient = new HttpClient(config)
    await httpClient.get(`/space/${spaceKey}`)
    return {
      name: 'Space access',
      status: 'pass',
      message: `Space "${spaceKey}" is accessible`,
    }
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('403')) {
      return {
        name: 'Space access',
        status: 'fail',
        message: `No permission to access space "${spaceKey}"`,
      }
    }
    if (message.includes('404')) {
      return {
        name: 'Space access',
        status: 'fail',
        message: `Space "${spaceKey}" not found`,
      }
    }
    return {
      name: 'Space access',
      status: 'fail',
      message: `Error checking space "${spaceKey}": ${message}`,
    }
  }
}

function outputResults(checks: DoctorCheck[], json: boolean): void {
  if (json) {
    console.log(formatJson(checks))
    return
  }
  console.log(chalk.blue('Confluence CLI Diagnostics:\n'))
  for (const check of checks) {
    const icon =
      check.status === 'pass'
        ? chalk.green('[pass]')
        : check.status === 'warn'
          ? chalk.yellow('[warn]')
          : chalk.red('[fail]')
    console.log(`  ${icon} ${chalk.bold(check.name)}: ${check.message}`)
  }
}
