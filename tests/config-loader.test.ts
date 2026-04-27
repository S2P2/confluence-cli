import { describe, expect, it, afterEach } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fetchCloudId, loadConfig, getEnvOverrides, normalizeApiPath, normalizeAuthType, normalizeProtocol } from '../src/config/loader';
import type { AppConfig } from '../src/config/types';

const TMPDIR = fs.mkdtempSync(path.join(os.tmpdir(), 'confluence-cli-test-'));

afterEach(() => {
  const envVars = [
    'CONFLUENCE_DOMAIN', 'CONFLUENCE_HOST', 'CONFLUENCE_API_TOKEN', 'CONFLUENCE_PASSWORD',
    'CONFLUENCE_EMAIL', 'CONFLUENCE_USERNAME', 'CONFLUENCE_AUTH_TYPE', 'CONFLUENCE_API_PATH',
    'CONFLUENCE_PROTOCOL', 'CONFLUENCE_READ_ONLY', 'CONFLUENCE_FORCE_CLOUD',
    'CONFLUENCE_SITE_URL', 'CONFLUENCE_LINK_STYLE', 'CONFLUENCE_COOKIE', 'CONFLUENCE_TLS_CA_CERT',
    'CONFLUENCE_TLS_CLIENT_CERT', 'CONFLUENCE_TLS_CLIENT_KEY', 'CONFLUENCE_PROFILE',
  ];
  for (const v of envVars) delete process.env[v];
});

describe('normalizeApiPath', () => {
  it('infers cloud path for atlassian.net domains', () => {
    expect(normalizeApiPath(undefined, 'example.atlassian.net')).toBe('/wiki/rest/api');
  });

  it('defaults to /rest/api for non-cloud domains', () => {
    expect(normalizeApiPath(undefined, 'wiki.example.com')).toBe('/rest/api');
  });

  it('uses provided apiPath', () => {
    expect(normalizeApiPath('/custom/api', 'example.atlassian.net')).toBe('/custom/api');
  });
});

describe('normalizeProtocol', () => {
  it('defaults to https', () => {
    expect(normalizeProtocol(undefined)).toBe('https');
  });

  it('preserves http', () => {
    expect(normalizeProtocol('http')).toBe('http');
  });

  it('lowercases input', () => {
    expect(normalizeProtocol('HTTPS')).toBe('https');
  });
});

describe('normalizeAuthType', () => {
  it('preserves service-account as its own type', () => {
    expect(normalizeAuthType('service-account', undefined)).toBe('service-account');
  });

  it('normalizes SERVICE-ACCOUNT case insensitively', () => {
    expect(normalizeAuthType('SERVICE-ACCOUNT', undefined)).toBe('service-account');
  });

  it('preserves basic auth type', () => {
    expect(normalizeAuthType('basic', 'user@example.com')).toBe('basic');
  });

  it('preserves bearer auth type', () => {
    expect(normalizeAuthType('bearer', undefined)).toBe('bearer');
  });

  it('defaults to basic when email is provided', () => {
    expect(normalizeAuthType(undefined, 'user@example.com')).toBe('basic');
  });

  it('defaults to bearer when no email', () => {
    expect(normalizeAuthType(undefined, undefined)).toBe('bearer');
  });

  it('rejects invalid auth types', () => {
    expect(() => normalizeAuthType('invalid', undefined)).toThrow(/Invalid auth type/);
  });
});

describe('fetchCloudId', () => {
  it('fetches cloudId from tenant_info endpoint', async () => {
    const cloudId = await fetchCloudId('jos2p2.atlassian.net');
    expect(cloudId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('throws for non-existent domain', async () => {
    expect(fetchCloudId('nonexistent-invalid.atlassian.net')).rejects.toThrow();
  });
});

describe('getEnvOverrides', () => {
  it('reads domain from CONFLUENCE_DOMAIN', () => {
    process.env.CONFLUENCE_DOMAIN = 'test.atlassian.net';
    const overrides = getEnvOverrides();
    expect(overrides.domain).toBe('test.atlassian.net');
  });

  it('reads domain from CONFLUENCE_HOST as fallback', () => {
    process.env.CONFLUENCE_HOST = 'fallback.atlassian.net';
    const overrides = getEnvOverrides();
    expect(overrides.domain).toBe('fallback.atlassian.net');
  });

  it('CONFLUENCE_DOMAIN takes priority over CONFLUENCE_HOST', () => {
    process.env.CONFLUENCE_DOMAIN = 'primary.atlassian.net';
    process.env.CONFLUENCE_HOST = 'fallback.atlassian.net';
    const overrides = getEnvOverrides();
    expect(overrides.domain).toBe('primary.atlassian.net');
  });

  it('reads read-only flag', () => {
    process.env.CONFLUENCE_READ_ONLY = 'true';
    const overrides = getEnvOverrides();
    expect(overrides.readOnly).toBe(true);
  });

  it('reads site URL', () => {
    process.env.CONFLUENCE_SITE_URL = 'https://example.atlassian.net';
    const overrides = getEnvOverrides();
    expect(overrides.siteUrl).toBe('https://example.atlassian.net');
  });

  it('returns empty object when no env vars set', () => {
    const overrides = getEnvOverrides();
    expect(Object.keys(overrides)).toHaveLength(0);
  });
});

describe('loadConfig', () => {
  it('loads and parses config file', () => {
    const config: AppConfig = {
      activeProfile: 'default',
      profiles: {
        default: {
          domain: 'test.atlassian.net',
          auth: { type: 'bearer', token: 'tok123' },
        },
      },
    };
    const configPath = path.join(TMPDIR, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config));
    const loaded = loadConfig(configPath);
    expect(loaded.activeProfile).toBe('default');
    expect(loaded.profiles['default']!.domain).toBe('test.atlassian.net');
  });

  it('throws for missing config file', () => {
    expect(() => loadConfig('/nonexistent/config.json')).toThrow();
  });

  it('throws for invalid JSON', () => {
    const configPath = path.join(TMPDIR, 'bad.json');
    fs.writeFileSync(configPath, 'not json');
    expect(() => loadConfig(configPath)).toThrow();
  });

  it('handles flat legacy format with auth fields on profile', () => {
    const legacy = {
      domain: 'legacy.atlassian.net',
      authType: 'basic',
      email: 'user@legacy.com',
      token: 'legacy-token',
      protocol: 'https',
      readOnly: true,
    };
    const configPath = path.join(TMPDIR, 'legacy.json');
    fs.writeFileSync(configPath, JSON.stringify(legacy));
    const loaded = loadConfig(configPath);
    expect(loaded.activeProfile).toBe('default');
    expect(loaded.profiles['default']!.domain).toBe('legacy.atlassian.net');
    expect(loaded.profiles['default']!.auth.type).toBe('basic');
  });

  it('handles multi-profile format with flat auth fields', () => {
    const multi = {
      activeProfile: 'work',
      profiles: {
        work: {
          domain: 'work.atlassian.net',
          authType: 'bearer',
          token: 'work-token',
        },
        personal: {
          domain: 'personal.atlassian.net',
          authType: 'basic',
          email: 'me@personal.com',
          token: 'personal-token',
        },
      },
    };
    const configPath = path.join(TMPDIR, 'multi.json');
    fs.writeFileSync(configPath, JSON.stringify(multi));
    const loaded = loadConfig(configPath);
    expect(loaded.activeProfile).toBe('work');
    expect(loaded.profiles['work']!.auth.type).toBe('bearer');
    expect(loaded.profiles['personal']!.auth.type).toBe('basic');
  });

  it('preserves siteUrl in config', () => {
    const config: AppConfig = {
      activeProfile: 'default',
      profiles: {
        default: {
          domain: 'api.atlassian.com',
          apiPath: '/ex/confluence/abc-123/wiki/rest/api',
          auth: { type: 'bearer', token: 'tok123' },
          forceCloud: true,
          siteUrl: 'https://example.atlassian.net',
        },
      },
    };
    const configPath = path.join(TMPDIR, 'siteurl.json');
    fs.writeFileSync(configPath, JSON.stringify(config));
    const loaded = loadConfig(configPath);
    expect(loaded.profiles['default']!.siteUrl).toBe('https://example.atlassian.net');
  });

  it('loads nested service-account auth without losing token', () => {
    const config: AppConfig = {
      activeProfile: 'default',
      profiles: {
        default: {
          domain: 'api.atlassian.com',
          apiPath: '/ex/confluence/cloud-uuid/wiki/rest/api',
          auth: { type: 'service-account', token: 'ATSTT-secret-token' },
          forceCloud: true,
          siteUrl: 'https://example.atlassian.net',
        },
      },
    };
    const configPath = path.join(TMPDIR, 'sa-nested.json');
    fs.writeFileSync(configPath, JSON.stringify(config));
    const loaded = loadConfig(configPath);
    const profile = loaded.profiles['default']!;
    expect(profile.auth.type).toBe('service-account');
    expect(profile.auth.token).toBe('ATSTT-secret-token');
    expect(profile.domain).toBe('api.atlassian.com');
    expect(profile.forceCloud).toBe(true);
    expect(profile.siteUrl).toBe('https://example.atlassian.net');
  });

  it('throws for active profile not in profiles', () => {
    const config = {
      activeProfile: 'missing',
      profiles: {
        default: { domain: 'test.atlassian.net', token: 'tok' },
      },
    };
    const configPath = path.join(TMPDIR, 'missing-profile.json');
    fs.writeFileSync(configPath, JSON.stringify(config));
    expect(() => loadConfig(configPath)).toThrow(/not found/);
  });
});
