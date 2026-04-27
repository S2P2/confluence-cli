import fs from 'node:fs'
import chalk from 'chalk'
import inquirer from 'inquirer'
import {
  CONFIG_DIR,
  CONFIG_FILE,
  fetchCloudId,
  loadConfig,
  normalizeApiPath,
  normalizeAuthType,
  normalizeProtocol,
} from './loader'
import type { AppConfig, ProfileConfig } from './types'
import { DEFAULT_PROFILE } from './types'

export interface ProfileInfo {
  name: string
  active: boolean
  domain: string
  readOnly: boolean
}

export function listProfiles(): { activeProfile: string; profiles: ProfileInfo[] } {
  const config = loadConfig()
  const profiles: ProfileInfo[] = Object.entries(config.profiles).map(([name, prof]) => ({
    name,
    active: name === config.activeProfile,
    domain: prof.domain,
    readOnly: prof.readOnly ?? false,
  }))
  return { activeProfile: config.activeProfile, profiles }
}

export function setActiveProfile(profileName: string): void {
  const config = loadConfig()
  if (!config.profiles[profileName]) {
    throw new Error(`Profile "${profileName}" not found. Available: ${Object.keys(config.profiles).join(', ')}`)
  }
  config.activeProfile = profileName
  writeConfig(config)
}

export function deleteProfile(profileName: string): void {
  const config = loadConfig()
  if (!config.profiles[profileName]) {
    throw new Error(`Profile "${profileName}" not found.`)
  }
  const remaining = Object.keys(config.profiles).filter((p) => p !== profileName)
  if (remaining.length === 0) {
    throw new Error('Cannot delete the last profile. Add another profile first.')
  }
  delete config.profiles[profileName]
  if (config.activeProfile === profileName) {
    config.activeProfile = remaining[0]!
  }
  writeConfig(config)
}

export function isValidProfileName(name: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(name)
}

export async function initConfig(cliOptions: {
  profile?: string
  domain?: string
  protocol?: string
  apiPath?: string
  authType?: string
  email?: string
  token?: string
  cookie?: string
  tlsCaCert?: string
  tlsClientCert?: string
  tlsClientKey?: string
  readOnly?: boolean
}): Promise<void> {
  const profileName = cliOptions.profile || DEFAULT_PROFILE
  const needsPrompts = !cliOptions.domain || !cliOptions.token

  let answers: Record<string, string> = {}
  if (needsPrompts) {
    answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'domain',
        message: 'Confluence domain (e.g., yourcompany.atlassian.net):',
        default: cliOptions.domain,
        validate: (v: string) => (v.trim() ? true : 'Domain is required'),
      },
      {
        type: 'list',
        name: 'authType',
        message: 'Authentication type:',
        choices: [
          { name: 'basic - Email/username + API token', value: 'basic' },
          { name: 'service-account - Atlassian service account (ATSTT token)', value: 'service-account' },
          { name: 'bearer - Personal access token (Data Center)', value: 'bearer' },
          { name: 'mtls - Client certificates', value: 'mtls' },
          { name: 'cookie - Session cookie (Enterprise SSO)', value: 'cookie' },
        ],
        default: cliOptions.authType || 'basic',
      },
      {
        type: 'input',
        name: 'email',
        message: 'Email or username:',
        when: (ans: Record<string, string>) => ans.authType === 'basic',
        default: cliOptions.email,
      },
      {
        type: 'password',
        name: 'token',
        message: 'API token or password:',
        mask: '*',
        default: cliOptions.token,
        validate: (v: string) => (v.trim() ? true : 'Token is required'),
      },
    ])
  }

  const rawDomain = (cliOptions.domain || answers.domain || '').trim()
  const rawAuthType = cliOptions.authType || answers.authType
  const authType = normalizeAuthType(rawAuthType, cliOptions.email || answers.email)
  const isServiceAccount = authType === 'service-account'
  const protocol = normalizeProtocol(cliOptions.protocol)

  // For service accounts with atlassian.net domain, fetch cloudId and configure gateway
  let domain = rawDomain
  let apiPath = normalizeApiPath(cliOptions.apiPath, domain)
  let siteUrl: string | undefined
  let forceCloud: boolean | undefined

  if (isServiceAccount && !cliOptions.apiPath) {
    if (rawDomain.includes('atlassian.net')) {
      console.log(chalk.blue('Fetching site info from tenant endpoint...'))
      try {
        const cloudId = await fetchCloudId(rawDomain)
        siteUrl = `https://${rawDomain}`
        domain = 'api.atlassian.com'
        apiPath = `/ex/confluence/${cloudId}/wiki/rest/api`
        forceCloud = true
        console.log(chalk.green(`Cloud ID: ${cloudId}`))
      } catch (err) {
        throw new Error(
          `Failed to fetch cloud ID for ${rawDomain}: ${(err as Error).message}\n` +
            'You can provide the API path manually with --api-path "/ex/confluence/<cloudId>/wiki/rest/api"',
        )
      }
    } else {
      // Non-atlassian.net domain with service account — user must provide api-path manually
      throw new Error(
        'Service account auth requires an atlassian.net domain to auto-configure the API gateway.\n' +
          'For custom domains, provide --api-path and --domain "api.atlassian.com" manually.',
      )
    }
  }

  let profile: ProfileConfig
  switch (authType) {
    case 'basic':
      profile = {
        domain,
        protocol,
        apiPath,
        auth: {
          type: 'basic',
          email: (cliOptions.email || answers.email || '').trim(),
          token: (cliOptions.token || answers.token || '').trim(),
        },
        readOnly: cliOptions.readOnly ?? false,
      }
      break
    case 'bearer':
      profile = {
        domain,
        protocol,
        apiPath,
        auth: { type: 'bearer', token: (cliOptions.token || answers.token || '').trim() },
        readOnly: cliOptions.readOnly ?? false,
      }
      break
    case 'service-account':
      profile = {
        domain,
        protocol,
        apiPath,
        auth: { type: 'service-account', token: (cliOptions.token || answers.token || '').trim() },
        readOnly: cliOptions.readOnly ?? false,
      }
      break
    case 'mtls':
      profile = {
        domain,
        protocol: 'https',
        apiPath,
        auth: {
          type: 'mtls',
          tlsCaCert: cliOptions.tlsCaCert?.trim() || '',
          tlsClientCert: cliOptions.tlsClientCert?.trim() || '',
          tlsClientKey: cliOptions.tlsClientKey?.trim() || '',
        },
        readOnly: cliOptions.readOnly ?? false,
      }
      break
    case 'cookie':
      profile = {
        domain,
        protocol,
        apiPath,
        auth: { type: 'cookie', cookie: (cliOptions.cookie || '').trim() },
        readOnly: cliOptions.readOnly ?? false,
      }
      break
  }

  if (siteUrl) profile.siteUrl = siteUrl
  if (forceCloud) profile.forceCloud = forceCloud

  let config: AppConfig
  try {
    config = loadConfig()
  } catch {
    config = { activeProfile: profileName, profiles: {} }
  }

  config.profiles[profileName] = profile
  if (Object.keys(config.profiles).length === 1) {
    config.activeProfile = profileName
  }

  writeConfig(config)
  console.log(chalk.green(`Profile "${profileName}" configured successfully.`))
}

function writeConfig(config: AppConfig): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 })
}
