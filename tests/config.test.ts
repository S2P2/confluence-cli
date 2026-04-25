import { describe, expect, it } from 'bun:test';
import type {
  AuthConfig,
  ProfileConfig,
  AppConfig,
  BasicAuthConfig,
  BearerAuthConfig,
  MtlsAuthConfig,
  CookieAuthConfig,
} from '../src/config/types';

describe('config types', () => {
  it('BasicAuthConfig has required fields', () => {
    const auth: BasicAuthConfig = { type: 'basic', email: 'user@example.com', token: 'token123' };
    expect(auth.type).toBe('basic');
    expect(auth.email).toBe('user@example.com');
  });

  it('BearerAuthConfig has required fields', () => {
    const auth: BearerAuthConfig = { type: 'bearer', token: 'ATSTT123' };
    expect(auth.type).toBe('bearer');
  });

  it('ProfileConfig accepts all optional fields', () => {
    const profile: ProfileConfig = {
      domain: 'example.atlassian.net',
      protocol: 'https',
      apiPath: '/wiki/rest/api',
      auth: { type: 'basic', email: 'u@e.com', token: 't' },
      readOnly: true,
      forceCloud: false,
      linkStyle: 'smart',
    };
    expect(profile.domain).toBe('example.atlassian.net');
    expect(profile.readOnly).toBe(true);
  });

  it('AppConfig has activeProfile and profiles map', () => {
    const config: AppConfig = {
      activeProfile: 'default',
      profiles: {
        default: {
          domain: 'example.atlassian.net',
          auth: { type: 'bearer', token: 'tok' },
        },
      },
    };
    expect(config.activeProfile).toBe('default');
    expect(Object.keys(config.profiles)).toHaveLength(1);
  });
});