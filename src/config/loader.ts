import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AppConfig, AuthConfig, AuthType, ProfileConfig, ResolvedConfig } from './types'
import { CONFIG_DIR_NAME, CONFIG_FILE_NAME, DEFAULT_PROFILE, ENV_VARS } from './types'

export const CONFIG_DIR = path.join(os.homedir(), CONFIG_DIR_NAME)
export const CONFIG_FILE = path.join(CONFIG_DIR, CONFIG_FILE_NAME)

export async function fetchCloudId(siteDomain: string): Promise<string> {
  const url = `https://${siteDomain.replace(/\/$/, '')}/_edge/tenant_info`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch tenant info from ${url}: ${res.status} ${res.statusText}`)
  }
  const data = (await res.json()) as { cloudId?: string }
  if (!data.cloudId) {
    throw new Error(`No cloudId found in tenant info response from ${url}`)
  }
  return data.cloudId
}

export function normalizeApiPath(apiPath: string | undefined, domain: string): string {
  if (apiPath) return apiPath.startsWith('/') ? apiPath : `/${apiPath}`
  if (domain.includes('atlassian.net')) return '/wiki/rest/api'
  return '/rest/api'
}

export function normalizeProtocol(protocol: string | undefined): 'http' | 'https' {
  if (!protocol) return 'https'
  const lower = protocol.toLowerCase()
  if (lower !== 'http' && lower !== 'https') {
    throw new Error(`Invalid protocol "${protocol}". Must be "http" or "https".`)
  }
  return lower as 'http' | 'https'
}

export function normalizeAuthType(authType: string | undefined, email: string | undefined): AuthType {
  if (authType) {
    const lower = authType.toLowerCase()
    if (!['basic', 'bearer', 'mtls', 'cookie', 'service-account'].includes(lower)) {
      throw new Error(`Invalid auth type "${authType}". Must be basic, service-account, bearer, mtls, or cookie.`)
    }
    return lower as AuthType
  }
  return email ? 'basic' : 'bearer'
}

export function getEnvOverrides(): Partial<ResolvedConfig> & { profile?: string } {
  const get = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const val = process.env[key]?.trim()
      if (val) return val
    }
    return undefined
  }

  const overrides: Partial<ResolvedConfig> & { profile?: string } = {}

  const domain = get(ENV_VARS.DOMAIN, ENV_VARS.HOST)
  if (domain) overrides.domain = domain

  const token = get(ENV_VARS.TOKEN, ENV_VARS.PASSWORD)
  if (token) overrides.token = token

  const email = get(ENV_VARS.EMAIL, ENV_VARS.USERNAME)
  if (email) overrides.email = email

  const authType = get(ENV_VARS.AUTH_TYPE)
  if (authType) overrides.authType = normalizeAuthType(authType, email)

  const apiPath = get(ENV_VARS.API_PATH)
  if (apiPath) overrides.apiPath = normalizeApiPath(apiPath, domain ?? '')

  const protocol = get(ENV_VARS.PROTOCOL)
  if (protocol) overrides.protocol = normalizeProtocol(protocol)

  const readOnly = get(ENV_VARS.READ_ONLY)
  if (readOnly) overrides.readOnly = readOnly.toLowerCase() === 'true'

  const forceCloud = get(ENV_VARS.FORCE_CLOUD)
  if (forceCloud) overrides.forceCloud = forceCloud.toLowerCase() === 'true'

  const siteUrl = get(ENV_VARS.SITE_URL)
  if (siteUrl) overrides.siteUrl = siteUrl

  const linkStyle = get(ENV_VARS.LINK_STYLE)
  if (linkStyle) overrides.linkStyle = linkStyle

  const cookie = get(ENV_VARS.COOKIE)
  if (cookie) overrides.cookie = cookie

  const tlsCaCert = get(ENV_VARS.TLS_CA_CERT)
  if (tlsCaCert) overrides.tlsCaCert = tlsCaCert

  const tlsClientCert = get(ENV_VARS.TLS_CLIENT_CERT)
  if (tlsClientCert) overrides.tlsClientCert = tlsClientCert

  const tlsClientKey = get(ENV_VARS.TLS_CLIENT_KEY)
  if (tlsClientKey) overrides.tlsClientKey = tlsClientKey

  const profile = get(ENV_VARS.PROFILE)
  if (profile) overrides.profile = profile

  return overrides
}

export function loadConfig(configPath: string = CONFIG_FILE): AppConfig {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}\nRun "confluence init" to create one.`)
  }

  const raw = fs.readFileSync(configPath, 'utf-8')
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`Invalid JSON in config file: ${configPath}`)
  }

  return validateConfig(parsed)
}

function validateConfig(raw: unknown): AppConfig {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Config must be a JSON object.')
  }
  const obj = raw as Record<string, unknown>

  // Multi-profile format
  if (obj.profiles && typeof obj.profiles === 'object') {
    const profiles = obj.profiles as Record<string, unknown>
    const activeProfile = (obj.activeProfile as string) || DEFAULT_PROFILE
    if (!profiles[activeProfile]) {
      throw new Error(`Active profile "${activeProfile}" not found in config.`)
    }
    const normalizedProfiles: Record<string, ProfileConfig> = {}
    for (const [name, prof] of Object.entries(profiles)) {
      normalizedProfiles[name] = normalizeProfileConfig(prof as Record<string, unknown>)
    }
    return { activeProfile, profiles: normalizedProfiles }
  }

  // Old flat format — migrate
  if (obj.domain) {
    return {
      activeProfile: DEFAULT_PROFILE,
      profiles: { [DEFAULT_PROFILE]: normalizeProfileConfig(obj) },
    }
  }

  throw new Error('Invalid config format. Run "confluence init" to reinitialize.')
}

function normalizeProfileConfig(raw: Record<string, unknown>): ProfileConfig {
  // Already in nested auth format — use directly
  if (raw.auth && typeof raw.auth === 'object') {
    return {
      domain: String(raw.domain || ''),
      protocol: (raw.protocol as 'http' | 'https') || undefined,
      apiPath: (raw.apiPath as string) || undefined,
      auth: raw.auth as AuthConfig,
      readOnly: raw.readOnly as boolean | undefined,
      forceCloud: raw.forceCloud as boolean | undefined,
      siteUrl: (raw.siteUrl as string) || undefined,
      linkStyle: raw.linkStyle as ProfileConfig['linkStyle'],
    }
  }

  // Legacy flat format — migrate to nested auth
  const authType = normalizeAuthType(raw.authType as string | undefined, raw.email as string | undefined)

  let auth: AuthConfig
  switch (authType) {
    case 'basic':
      auth = { type: 'basic', email: String(raw.email || ''), token: String(raw.token || '') }
      break
    case 'bearer':
      auth = { type: 'bearer', token: String(raw.token || '') }
      break
    case 'service-account':
      auth = { type: 'service-account', token: String(raw.token || '') }
      break
    case 'mtls':
      auth = {
        type: 'mtls',
        tlsCaCert: String(raw.tlsCaCert || (raw.mtls as Record<string, unknown>)?.caCert || ''),
        tlsClientCert: String(raw.tlsClientCert || (raw.mtls as Record<string, unknown>)?.clientCert || ''),
        tlsClientKey: String(raw.tlsClientKey || (raw.mtls as Record<string, unknown>)?.clientKey || ''),
      }
      break
    case 'cookie':
      auth = { type: 'cookie', cookie: String(raw.cookie || '') }
      break
  }

  return {
    domain: String(raw.domain || ''),
    protocol: (raw.protocol as 'http' | 'https') || undefined,
    apiPath: (raw.apiPath as string) || undefined,
    auth,
    readOnly: raw.readOnly as boolean | undefined,
    forceCloud: raw.forceCloud as boolean | undefined,
    siteUrl: (raw.siteUrl as string) || undefined,
    linkStyle: raw.linkStyle as ProfileConfig['linkStyle'],
  }
}

export function resolveProfile(config: AppConfig, profileName?: string): ProfileConfig {
  const overrides = getEnvOverrides()
  const name = overrides.profile || profileName || config.activeProfile
  const profile = config.profiles[name]
  if (!profile) {
    throw new Error(`Profile "${name}" not found. Available: ${Object.keys(config.profiles).join(', ')}`)
  }
  return profile
}

export function getConfig(profileName?: string): ResolvedConfig {
  const appConfig = loadConfig()
  const profile = resolveProfile(appConfig, profileName)
  const envOverrides = getEnvOverrides()

  const domain = envOverrides.domain || profile.domain
  const protocol = normalizeProtocol(envOverrides.protocol || profile.protocol)
  const auth = profile.auth

  return {
    domain,
    protocol,
    apiPath: envOverrides.apiPath || normalizeApiPath(profile.apiPath, domain),
    authType: envOverrides.authType || auth.type,
    token: envOverrides.token || ('token' in auth ? auth.token : undefined),
    email: envOverrides.email || ('email' in auth ? auth.email : undefined),
    cookie: envOverrides.cookie || ('cookie' in auth ? auth.cookie : undefined),
    tlsCaCert: envOverrides.tlsCaCert || ('tlsCaCert' in auth ? auth.tlsCaCert : undefined),
    tlsClientCert: envOverrides.tlsClientCert || ('tlsClientCert' in auth ? auth.tlsClientCert : undefined),
    tlsClientKey: envOverrides.tlsClientKey || ('tlsClientKey' in auth ? auth.tlsClientKey : undefined),
    readOnly: envOverrides.readOnly ?? profile.readOnly ?? false,
    forceCloud: envOverrides.forceCloud ?? profile.forceCloud ?? false,
    siteUrl: envOverrides.siteUrl || profile.siteUrl,
    linkStyle: envOverrides.linkStyle || profile.linkStyle || 'auto',
  }
}
