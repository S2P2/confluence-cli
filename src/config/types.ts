export type AuthType = 'basic' | 'bearer' | 'mtls' | 'cookie' | 'service-account'

export interface BasicAuthConfig {
  type: 'basic'
  email: string
  token: string
}

export interface BearerAuthConfig {
  type: 'bearer'
  token: string
}

export interface ServiceAccountAuthConfig {
  type: 'service-account'
  token: string
}

export interface MtlsAuthConfig {
  type: 'mtls'
  token?: string
  tlsCaCert: string
  tlsClientCert: string
  tlsClientKey: string
}

export interface CookieAuthConfig {
  type: 'cookie'
  cookie: string
}

export type AuthConfig =
  | BasicAuthConfig
  | BearerAuthConfig
  | ServiceAccountAuthConfig
  | MtlsAuthConfig
  | CookieAuthConfig

export interface ProfileConfig {
  domain: string
  protocol?: 'http' | 'https'
  apiPath?: string
  auth: AuthConfig
  readOnly?: boolean
  forceCloud?: boolean
  siteUrl?: string
  linkStyle?: 'smart' | 'plain' | 'wiki' | 'auto'
}

export interface AppConfig {
  activeProfile: string
  profiles: Record<string, ProfileConfig>
}

export interface ResolvedConfig {
  domain: string
  protocol: 'http' | 'https'
  apiPath: string
  authType: AuthType
  token?: string
  email?: string
  cookie?: string
  tlsCaCert?: string
  tlsClientCert?: string
  tlsClientKey?: string
  readOnly: boolean
  forceCloud: boolean
  siteUrl?: string
  linkStyle: string
}

export const ENV_VARS = {
  DOMAIN: 'CONFLUENCE_DOMAIN',
  HOST: 'CONFLUENCE_HOST',
  TOKEN: 'CONFLUENCE_API_TOKEN',
  PASSWORD: 'CONFLUENCE_PASSWORD',
  EMAIL: 'CONFLUENCE_EMAIL',
  USERNAME: 'CONFLUENCE_USERNAME',
  AUTH_TYPE: 'CONFLUENCE_AUTH_TYPE',
  API_PATH: 'CONFLUENCE_API_PATH',
  PROTOCOL: 'CONFLUENCE_PROTOCOL',
  READ_ONLY: 'CONFLUENCE_READ_ONLY',
  FORCE_CLOUD: 'CONFLUENCE_FORCE_CLOUD',
  SITE_URL: 'CONFLUENCE_SITE_URL',
  LINK_STYLE: 'CONFLUENCE_LINK_STYLE',
  COOKIE: 'CONFLUENCE_COOKIE',
  TLS_CA_CERT: 'CONFLUENCE_TLS_CA_CERT',
  TLS_CLIENT_CERT: 'CONFLUENCE_TLS_CLIENT_CERT',
  TLS_CLIENT_KEY: 'CONFLUENCE_TLS_CLIENT_KEY',
  PROFILE: 'CONFLUENCE_PROFILE',
} as const

export const DEFAULT_PROFILE = 'default'
export const CONFIG_DIR_NAME = '.confluence-cli'
export const CONFIG_FILE_NAME = 'config.json'
