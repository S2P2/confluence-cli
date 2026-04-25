import fs from 'node:fs';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { loadConfig, CONFIG_DIR, CONFIG_FILE } from './loader';
import { normalizeApiPath, normalizeProtocol, normalizeAuthType } from './loader';
import type { AppConfig, ProfileConfig } from './types';
import { DEFAULT_PROFILE } from './types';

export interface ProfileInfo {
  name: string;
  active: boolean;
  domain: string;
  readOnly: boolean;
}

export function listProfiles(): { activeProfile: string; profiles: ProfileInfo[] } {
  const config = loadConfig();
  const profiles: ProfileInfo[] = Object.entries(config.profiles).map(([name, prof]) => ({
    name,
    active: name === config.activeProfile,
    domain: prof.domain,
    readOnly: prof.readOnly ?? false,
  }));
  return { activeProfile: config.activeProfile, profiles };
}

export function setActiveProfile(profileName: string): void {
  const config = loadConfig();
  if (!config.profiles[profileName]) {
    throw new Error(`Profile "${profileName}" not found. Available: ${Object.keys(config.profiles).join(', ')}`);
  }
  config.activeProfile = profileName;
  writeConfig(config);
}

export function deleteProfile(profileName: string): void {
  const config = loadConfig();
  if (!config.profiles[profileName]) {
    throw new Error(`Profile "${profileName}" not found.`);
  }
  const remaining = Object.keys(config.profiles).filter((p) => p !== profileName);
  if (remaining.length === 0) {
    throw new Error('Cannot delete the last profile. Add another profile first.');
  }
  delete config.profiles[profileName];
  if (config.activeProfile === profileName) {
    config.activeProfile = remaining[0]!;
  }
  writeConfig(config);
}

export function isValidProfileName(name: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(name);
}

export async function initConfig(cliOptions: {
  profile?: string;
  domain?: string;
  protocol?: string;
  apiPath?: string;
  authType?: string;
  email?: string;
  token?: string;
  cookie?: string;
  tlsCaCert?: string;
  tlsClientCert?: string;
  tlsClientKey?: string;
  readOnly?: boolean;
}): Promise<void> {
  const profileName = cliOptions.profile || DEFAULT_PROFILE;
  const needsPrompts = !cliOptions.domain || !cliOptions.token;

  let answers: Record<string, string> = {};
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
        choices: ['basic', 'bearer', 'mtls', 'cookie'],
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
    ]);
  }

  const domain = (cliOptions.domain || answers.domain || '').trim();
  const authType = normalizeAuthType(cliOptions.authType || answers.authType, cliOptions.email || answers.email);
  const protocol = normalizeProtocol(cliOptions.protocol);
  const apiPath = normalizeApiPath(cliOptions.apiPath, domain);

  let profile: ProfileConfig;
  switch (authType) {
    case 'basic':
      profile = {
        domain, protocol, apiPath,
        auth: { type: 'basic', email: (cliOptions.email || answers.email || '').trim(), token: (cliOptions.token || answers.token || '').trim() },
        readOnly: cliOptions.readOnly ?? false,
      };
      break;
    case 'bearer':
      profile = {
        domain, protocol, apiPath,
        auth: { type: 'bearer', token: (cliOptions.token || answers.token || '').trim() },
        readOnly: cliOptions.readOnly ?? false,
      };
      break;
    case 'mtls':
      profile = {
        domain, protocol: 'https', apiPath,
        auth: {
          type: 'mtls',
          tlsCaCert: cliOptions.tlsCaCert?.trim() || '',
          tlsClientCert: cliOptions.tlsClientCert?.trim() || '',
          tlsClientKey: cliOptions.tlsClientKey?.trim() || '',
        },
        readOnly: cliOptions.readOnly ?? false,
      };
      break;
    case 'cookie':
      profile = {
        domain, protocol, apiPath,
        auth: { type: 'cookie', cookie: (cliOptions.cookie || '').trim() },
        readOnly: cliOptions.readOnly ?? false,
      };
      break;
  }

  let config: AppConfig;
  try {
    config = loadConfig();
  } catch {
    config = { activeProfile: profileName, profiles: {} };
  }

  config.profiles[profileName] = profile;
  if (Object.keys(config.profiles).length === 1) {
    config.activeProfile = profileName;
  }

  writeConfig(config);
  console.log(chalk.green(`Profile "${profileName}" configured successfully.`));
}

function writeConfig(config: AppConfig): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}
