# Confluence CLI TypeScript Rewrite + Feature Additions

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite pchuri/confluence-cli from JavaScript to TypeScript and add blog posts, labels, doctor, search filters, space details, and global `--json` output.

**Architecture:** Incremental file-by-file migration. Each task produces a working CLI. The existing `bin/` and `lib/` JS files are kept until their TS replacements are complete and tested. New features are added as new TS modules. Commander.js stays as the CLI framework.

**Tech Stack:** TypeScript, Bun (Node >=18 compatible), Commander.js, Axios, tsup, Biome, bun test.

---

## File Map

Files created or modified across all tasks:

| File | Responsibility |
|------|---------------|
| `tsconfig.json` | TypeScript config (strict, ESM) |
| `tsup.config.ts` | Build config (dual CJS/ESM output) |
| `biome.json` | Lint + format rules |
| `package.json` | Updated deps, scripts, bin entries |
| `src/config/types.ts` | Config/profile type definitions |
| `src/config/loader.ts` | Config file loading, env var resolution, validation |
| `src/config/profiles.ts` | Profile CRUD (list, add, use, remove) |
| `src/config/index.ts` | Re-exports for config module |
| `src/client/types.ts` | API response types (pages, comments, attachments, etc.) |
| `src/client/http.ts` | Axios wrapper, auth headers, retry, URL building |
| `src/client/pages.ts` | Page CRUD, tree, export, find |
| `src/client/blog.ts` | Blog post CRUD (new) |
| `src/client/comments.ts` | Comment list, create, delete, format |
| `src/client/attachments.ts` | Attachment list, upload, download, delete |
| `src/client/labels.ts` | Label list, add, remove (new) |
| `src/client/properties.ts` | Property list, get, set, delete |
| `src/client/search.ts` | Search with space/type filters |
| `src/client/spaces.ts` | Space list, get |
| `src/client/index.ts` | Re-exports for client module |
| `src/format/markdown.ts` | HTML ↔ Markdown conversion |
| `src/format/macro.ts` | Confluence macro conversion |
| `src/format/output.ts` | Table/JSON/text output formatting |
| `src/format/index.ts` | Re-exports for format module |
| `src/utils/fs.ts` | File system helpers (sanitize, unique path) |
| `src/utils/url.ts` | URL building and page ID extraction |
| `src/commands/pages.ts` | Page CLI commands (read, info, create, update, delete, move, find, children, copy-tree) |
| `src/commands/blog.ts` | Blog CLI commands (list, get, create, update, delete) |
| `src/commands/comments.ts` | Comment CLI commands (list, create, delete) |
| `src/commands/attachments.ts` | Attachment CLI commands (list, upload, download, delete) |
| `src/commands/labels.ts` | Label CLI commands (list, add, remove) |
| `src/commands/properties.ts` | Property CLI commands (list, get, set, delete) |
| `src/commands/search.ts` | Search CLI command |
| `src/commands/spaces.ts` | Space CLI commands (list, get) |
| `src/commands/export.ts` | Export CLI command |
| `src/commands/doctor.ts` | Doctor CLI command (new) |
| `src/commands/profile.ts` | Profile CLI commands (list, add, use, remove) |
| `src/commands/convert.ts` | Convert CLI command |
| `src/cli.ts` | Commander program setup, global options, register all commands |
| `src/index.ts` | Entry point |
| `src/analytics.ts` | Anonymous usage tracking |
| `tests/config.test.ts` | Config tests |
| `tests/client/pages.test.ts` | Page client tests |
| `tests/client/blog.test.ts` | Blog client tests |
| `tests/client/labels.test.ts` | Label client tests |
| `tests/client/attachments.test.ts` | Attachment client tests |
| `tests/client/comments.test.ts` | Comment client tests |
| `tests/client/properties.test.ts` | Property client tests |
| `tests/client/search.test.ts` | Search client tests |
| `tests/client/spaces.test.ts` | Space client tests |
| `tests/commands/doctor.test.ts` | Doctor command tests |
| `tests/format/macro.test.ts` | Macro conversion tests |
| `tests/format/markdown.test.ts` | Markdown conversion tests |

---

### Task 1: Project Scaffolding

**Files:**
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `biome.json`
- Modify: `package.json`

- [ ] **Step 1: Add TypeScript and build dependencies**

```bash
cd /home/jo/projects/confluence-cli/confluence-cli
bun add -d typescript tsup @types/node @types/commander @types/inquirer @types/html-to-text
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create tsup.config.ts**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'bin/confluence': 'src/index.ts',
    index: 'src/cli.ts',
  },
  format: ['esm'],
  target: 'node18',
  outDir: 'dist',
  clean: true,
  dts: true,
  sourcemap: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
```

- [ ] **Step 4: Create biome.json**

```json
{
  "linter": {
    "recommended": true,
    "rules": {
      "style": {
        "useImportType": "error",
        "noParameterAssign": "error"
      },
      "suspicious": {
        "noExplicitAny": "error",
        "noUnsafeDeclarationMerge": "error"
      },
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error"
      }
    }
  },
  "formatter": {
    "lineWidth": 120,
    "indentStyle": "space"
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "asNeeded'
    }
  }
}
```

- [ ] **Step 5: Update package.json**

Add to `package.json`:

```json
{
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "bin": {
    "confluence": "dist/bin/confluence.js",
    "confluence-cli": "dist/bin/confluence.js"
  },
  "files": ["dist/", "plugins/", ".claude-plugin/"],
  "scripts": {
    "build": "tsup",
    "dev": "bun run src/index.ts",
    "lint": "biome check src/",
    "lint:fix": "biome check --fix src/",
    "typecheck": "tsc --noEmit",
    "test": "bun test",
    "prepublishOnly": "bun run build"
  }
}
```

- [ ] **Step 6: Create src directory**

```bash
mkdir -p src/config src/client src/commands src/format src/utils tests/client tests/commands tests/format
```

- [ ] **Step 7: Verify scaffolding**

```bash
bun run typecheck
bun run lint
```

Expected: typecheck may report no files (expected — no .ts files yet), lint passes.

- [ ] **Step 8: Commit**

```bash
git add tsconfig.json tsup.config.ts biome.json package.json bun.lock src/ tests/
git commit -m "chore: add TypeScript scaffolding (tsconfig, biome, tsup)"
```

---

### Task 2: Config Types

**Files:**
- Create: `src/config/types.ts`

- [ ] **Step 1: Write config type tests**

Create `tests/config.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/config.test.ts
```

Expected: FAIL — cannot resolve `../src/config/types`.

- [ ] **Step 3: Create config type definitions**

Create `src/config/types.ts`:

```typescript
export type AuthType = 'basic' | 'bearer' | 'mtls' | 'cookie';

export interface BasicAuthConfig {
  type: 'basic';
  email: string;
  token: string;
}

export interface BearerAuthConfig {
  type: 'bearer';
  token: string;
}

export interface MtlsAuthConfig {
  type: 'mtls';
  token?: string;
  tlsCaCert: string;
  tlsClientCert: string;
  tlsClientKey: string;
}

export interface CookieAuthConfig {
  type: 'cookie';
  cookie: string;
}

export type AuthConfig = BasicAuthConfig | BearerAuthConfig | MtlsAuthConfig | CookieAuthConfig;

export interface ProfileConfig {
  domain: string;
  protocol?: 'http' | 'https';
  apiPath?: string;
  auth: AuthConfig;
  readOnly?: boolean;
  forceCloud?: boolean;
  linkStyle?: 'smart' | 'plain' | 'wiki' | 'auto';
}

export interface AppConfig {
  activeProfile: string;
  profiles: Record<string, ProfileConfig>;
}

/** The resolved config passed to ConfluenceClient — flattened for convenience. */
export interface ResolvedConfig {
  domain: string;
  protocol: 'http' | 'https';
  apiPath: string;
  authType: AuthType;
  token?: string;
  email?: string;
  cookie?: string;
  tlsCaCert?: string;
  tlsClientCert?: string;
  tlsClientKey?: string;
  readOnly: boolean;
  forceCloud: boolean;
  linkStyle: string;
}

/** Environment variable names for config overrides. */
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
  LINK_STYLE: 'CONFLUENCE_LINK_STYLE',
  COOKIE: 'CONFLUENCE_COOKIE',
  TLS_CA_CERT: 'CONFLUENCE_TLS_CA_CERT',
  TLS_CLIENT_CERT: 'CONFLUENCE_TLS_CLIENT_CERT',
  TLS_CLIENT_KEY: 'CONFLUENCE_TLS_CLIENT_KEY',
  PROFILE: 'CONFLUENCE_PROFILE',
} as const;

export const DEFAULT_PROFILE = 'default';
export const CONFIG_DIR_NAME = '.confluence-cli';
export const CONFIG_FILE_NAME = 'config.json';
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/config.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/config/types.ts tests/config.test.ts
git commit -m "feat: add config type definitions"
```

---

### Task 3: Config Loader

**Files:**
- Create: `src/config/loader.ts`
- Create: `src/config/profiles.ts`
- Create: `src/config/index.ts`

- [ ] **Step 1: Write config loader tests**

Create `tests/config-loader.test.ts`:

```typescript
import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadConfig, getConfig, getEnvOverrides } from '../src/config/loader';
import { normalizeApiPath, normalizeProtocol } from '../src/config/loader';
import type { AppConfig } from '../src/config/types';

const TMPDIR = fs.mkdtempSync(path.join(os.tmpdir(), 'confluence-cli-test-'));

afterEach(() => {
  const envVars = [
    'CONFLUENCE_DOMAIN', 'CONFLUENCE_HOST', 'CONFLUENCE_API_TOKEN', 'CONFLUENCE_PASSWORD',
    'CONFLUENCE_EMAIL', 'CONFLUENCE_USERNAME', 'CONFLUENCE_AUTH_TYPE', 'CONFLUENCE_API_PATH',
    'CONFLUENCE_PROTOCOL', 'CONFLUENCE_READ_ONLY', 'CONFLUENCE_FORCE_CLOUD',
    'CONFLUENCE_LINK_STYLE', 'CONFLUENCE_COOKIE', 'CONFLUENCE_TLS_CA_CERT',
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
    expect(loaded.profiles['default'].domain).toBe('test.atlassian.net');
  });

  it('throws for missing config file', () => {
    expect(() => loadConfig('/nonexistent/config.json')).toThrow();
  });

  it('throws for invalid JSON', () => {
    const configPath = path.join(TMPDIR, 'bad.json');
    fs.writeFileSync(configPath, 'not json');
    expect(() => loadConfig(configPath)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/config-loader.test.ts
```

Expected: FAIL — cannot resolve `../src/config/loader`.

- [ ] **Step 3: Create config loader**

Create `src/config/loader.ts`:

```typescript
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { AppConfig, AuthType, ProfileConfig, ResolvedConfig } from './types';
import { ENV_VARS, DEFAULT_PROFILE, CONFIG_DIR_NAME, CONFIG_FILE_NAME } from './types';

export const CONFIG_DIR = path.join(os.homedir(), CONFIG_DIR_NAME);
export const CONFIG_FILE = path.join(CONFIG_DIR, CONFIG_FILE_NAME);

export function normalizeApiPath(apiPath: string | undefined, domain: string): string {
  if (apiPath) return apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  if (domain.includes('atlassian.net')) return '/wiki/rest/api';
  return '/rest/api';
}

export function normalizeProtocol(protocol: string | undefined): 'http' | 'https' {
  if (!protocol) return 'https';
  const lower = protocol.toLowerCase();
  if (lower !== 'http' && lower !== 'https') {
    throw new Error(`Invalid protocol "${protocol}". Must be "http" or "https".`);
  }
  return lower as 'http' | 'https';
}

export function normalizeAuthType(
  authType: string | undefined,
  email: string | undefined,
): AuthType {
  if (authType) {
    const lower = authType.toLowerCase();
    if (!['basic', 'bearer', 'mtls', 'cookie'].includes(lower)) {
      throw new Error(`Invalid auth type "${authType}". Must be basic, bearer, mtls, or cookie.`);
    }
    return lower as AuthType;
  }
  return email ? 'basic' : 'bearer';
}

export function getEnvOverrides(): Partial<ResolvedConfig> & { profile?: string } {
  const get = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const val = process.env[key]?.trim();
      if (val) return val;
    }
    return undefined;
  };

  const overrides: Partial<ResolvedConfig> & { profile?: string } = {};

  const domain = get(ENV_VARS.DOMAIN, ENV_VARS.HOST);
  if (domain) overrides.domain = domain;

  const token = get(ENV_VARS.TOKEN, ENV_VARS.PASSWORD);
  if (token) overrides.token = token;

  const email = get(ENV_VARS.EMAIL, ENV_VARS.USERNAME);
  if (email) overrides.email = email;

  const authType = get(ENV_VARS.AUTH_TYPE);
  if (authType) overrides.authType = normalizeAuthType(authType, email);

  const apiPath = get(ENV_VARS.API_PATH);
  if (apiPath) overrides.apiPath = normalizeApiPath(apiPath, domain ?? '');

  const protocol = get(ENV_VARS.PROTOCOL);
  if (protocol) overrides.protocol = normalizeProtocol(protocol);

  const readOnly = get(ENV_VARS.READ_ONLY);
  if (readOnly) overrides.readOnly = readOnly.toLowerCase() === 'true';

  const forceCloud = get(ENV_VARS.FORCE_CLOUD);
  if (forceCloud) overrides.forceCloud = forceCloud.toLowerCase() === 'true';

  const linkStyle = get(ENV_VARS.LINK_STYLE);
  if (linkStyle) overrides.linkStyle = linkStyle;

  const cookie = get(ENV_VARS.COOKIE);
  if (cookie) overrides.cookie = cookie;

  const tlsCaCert = get(ENV_VARS.TLS_CA_CERT);
  if (tlsCaCert) overrides.tlsCaCert = tlsCaCert;

  const tlsClientCert = get(ENV_VARS.TLS_CLIENT_CERT);
  if (tlsClientCert) overrides.tlsClientCert = tlsClientCert;

  const tlsClientKey = get(ENV_VARS.TLS_CLIENT_KEY);
  if (tlsClientKey) overrides.tlsClientKey = tlsClientKey;

  const profile = get(ENV_VARS.PROFILE);
  if (profile) overrides.profile = profile;

  return overrides;
}

export function loadConfig(configPath: string = CONFIG_FILE): AppConfig {
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Config file not found: ${configPath}\nRun "confluence init" to create one.`,
    );
  }

  const raw = fs.readFileSync(configPath, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in config file: ${configPath}`);
  }

  return validateConfig(parsed);
}

function validateConfig(raw: unknown): AppConfig {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Config must be a JSON object.');
  }
  const obj = raw as Record<string, unknown>;

  // Support old flat format
  if (obj.profiles && typeof obj.profiles === 'object') {
    const profiles = obj.profiles as Record<string, unknown>;
    const activeProfile = (obj.activeProfile as string) || DEFAULT_PROFILE;
    if (!profiles[activeProfile]) {
      throw new Error(`Active profile "${activeProfile}" not found in config.`);
    }
    return { activeProfile, profiles: profiles as AppConfig['profiles'] };
  }

  // Migrate old flat format
  if (obj.domain) {
    return {
      activeProfile: DEFAULT_PROFILE,
      profiles: { [DEFAULT_PROFILE]: obj as unknown as ProfileConfig },
    };
  }

  throw new Error('Invalid config format. Run "confluence init" to reinitialize.');
}

export function resolveProfile(config: AppConfig, profileName?: string): ProfileConfig {
  const overrides = getEnvOverrides();
  const name = overrides.profile || profileName || config.activeProfile;

  const profile = config.profiles[name];
  if (!profile) {
    throw new Error(
      `Profile "${name}" not found. Available: ${Object.keys(config.profiles).join(', ')}`,
    );
  }
  return profile;
}

export function getConfig(profileName?: string): ResolvedConfig {
  const appConfig = loadConfig();
  const profile = resolveProfile(appConfig, profileName);
  const envOverrides = getEnvOverrides();

  const domain = envOverrides.domain || profile.domain;
  const protocol = normalizeProtocol(envOverrides.protocol || profile.protocol);
  const auth = profile.auth;

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
    linkStyle: envOverrides.linkStyle || profile.linkStyle || 'auto',
  };
}
```

- [ ] **Step 4: Create profile management module**

Create `src/config/profiles.ts`:

```typescript
import fs from 'node:fs';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { loadConfig, CONFIG_DIR, CONFIG_FILE } from './loader';
import { normalizeApiPath, normalizeProtocol, normalizeAuthType } from './loader';
import type { AppConfig, ProfileConfig, AuthType } from './types';
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
    config.activeProfile = remaining[0];
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

  const needsPrompts =
    !cliOptions.domain ||
    !cliOptions.token ||
    (!cliOptions.email && !cliOptions.cookie && !cliOptions.tlsClientCert);

  let answers: Record<string, string | undefined>;
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
  } else {
    answers = {};
  }

  const domain = (cliOptions.domain || answers.domain || '').trim();
  const authType = normalizeAuthType(
    cliOptions.authType || answers.authType,
    cliOptions.email || answers.email,
  );
  const protocol = normalizeProtocol(cliOptions.protocol);
  const apiPath = normalizeApiPath(cliOptions.apiPath, domain);

  let profile: ProfileConfig;
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
      };
      break;
    case 'bearer':
      profile = {
        domain,
        protocol,
        apiPath,
        auth: { type: 'bearer', token: (cliOptions.token || answers.token || '').trim() },
        readOnly: cliOptions.readOnly ?? false,
      };
      break;
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
      };
      break;
    case 'cookie':
      profile = {
        domain,
        protocol,
        apiPath,
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
```

- [ ] **Step 5: Create config index**

Create `src/config/index.ts`:

```typescript
export type { AuthConfig, BasicAuthConfig, BearerAuthConfig, MtlsAuthConfig, CookieAuthConfig, ProfileConfig, AppConfig, ResolvedConfig } from './types';
export { loadConfig, getConfig, CONFIG_DIR, CONFIG_FILE } from './loader';
export { listProfiles, setActiveProfile, deleteProfile, isValidProfileName, initConfig } from './profiles';
export { normalizeApiPath, normalizeProtocol } from './loader';
```

- [ ] **Step 6: Run tests**

```bash
bun test tests/config-loader.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/config/ tests/config-loader.test.ts
git commit -m "feat: add config loader with env var resolution and profile management"
```

---

### Task 4: HTTP Client

**Files:**
- Create: `src/client/http.ts`

- [ ] **Step 1: Write HTTP client tests**

Create `tests/client/http.test.ts`:

```typescript
import { describe, expect, it } from 'bun:test';
import { HttpClient } from '../../src/client/http';
import type { ResolvedConfig } from '../../src/config/types';

function makeConfig(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return {
    domain: 'test.atlassian.net',
    protocol: 'https',
    apiPath: '/wiki/rest/api',
    authType: 'bearer',
    token: 'test-token',
    readOnly: false,
    forceCloud: false,
    linkStyle: 'auto',
    ...overrides,
  };
}

describe('HttpClient', () => {
  it('builds correct base URL', () => {
    const client = new HttpClient(makeConfig());
    expect(client.baseUrl).toBe('https://test.atlassian.net/wiki/rest/api');
  });

  it('builds URL with api.atlassian.com gateway', () => {
    const client = new HttpClient(
      makeConfig({
        domain: 'api.atlassian.com',
        apiPath: '/ex/confluence/abc-123/wiki/rest/api',
      }),
    );
    expect(client.baseUrl).toBe('https://api.atlassian.com/ex/confluence/abc-123/wiki/rest/api');
  });

  it('detects cloud instances', () => {
    const cloud = new HttpClient(makeConfig());
    expect(cloud.isCloud()).toBe(true);
  });

  it('detects non-cloud instances', () => {
    const dc = new HttpClient(makeConfig({ domain: 'wiki.example.com' }));
    expect(dc.isCloud()).toBe(false);
  });

  it('builds auth headers for bearer', () => {
    const client = new HttpClient(makeConfig({ authType: 'bearer', token: 'tok123' }));
    const headers = client.buildAuthHeaders();
    expect(headers.Authorization).toBe('Bearer tok123');
  });

  it('builds auth headers for basic', () => {
    const client = new HttpClient(
      makeConfig({ authType: 'basic', email: 'u@e.com', token: 'tok123' }),
    );
    const headers = client.buildAuthHeaders();
    expect(headers.Authorization).toMatch(/^Basic /);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/client/http.test.ts
```

Expected: FAIL — cannot resolve `../../src/client/http`.

- [ ] **Step 3: Create HTTP client**

Create `src/client/http.ts`:

```typescript
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import https from 'node:https';
import fs from 'node:fs';
import type { ResolvedConfig } from '../config/types';

export class HttpClient {
  public readonly baseUrl: string;
  private readonly config: ResolvedConfig;
  private readonly axiosInstance: AxiosInstance;

  constructor(config: ResolvedConfig) {
    this.config = config;
    this.baseUrl = `${config.protocol}://${config.domain}${config.apiPath}`;

    const axiosConfig: AxiosRequestConfig = {
      baseURL: this.baseUrl,
      headers: this.buildAuthHeaders(),
      timeout: 30_000,
    };

    if (config.authType === 'mtls') {
      axiosConfig.httpsAgent = this.buildHttpsAgent();
    }

    this.axiosInstance = axios.create(axiosConfig);
  }

  public isCloud(): boolean {
    return this.config.domain.includes('atlassian.net') || this.config.forceCloud;
  }

  public buildAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    switch (this.config.authType) {
      case 'basic': {
        const credentials = Buffer.from(`${this.config.email}:${this.config.token}`).toString('base64');
        headers.Authorization = `Basic ${credentials}`;
        break;
      }
      case 'bearer':
        headers.Authorization = `Bearer ${this.config.token}`;
        break;
      case 'cookie':
        headers.Cookie = this.config.cookie || '';
        break;
      case 'mtls':
        // mTLS uses certificates, but may also need a token
        if (this.config.token) {
          headers.Authorization = `Bearer ${this.config.token}`;
        }
        break;
    }

    return headers;
  }

  public async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.axiosInstance.get<T>(url, { params });
    return response.data;
  }

  public async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.post<T>(url, data, config);
    return response.data;
  }

  public async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.put<T>(url, data, config);
    return response.data;
  }

  public async delete<T>(url: string): Promise<T> {
    const response = await this.axiosInstance.delete<T>(url);
    return response.data;
  }

  public buildUrl(path: string): string {
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return `${this.config.protocol}://${this.config.domain}${path}`;
  }

  public extractPageId(input: string): string {
    if (/^\d+$/.test(input.trim())) return input.trim();

    const patterns = [
      /\/pages\/(\d+)/,
      /pageId=(\d+)/,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match?.[1]) return match[1];
    }

    throw new Error(
      `Cannot extract page ID from "${input}". Provide a numeric page ID or a Confluence page URL.`,
    );
  }

  private buildHttpsAgent(): https.Agent {
    const options: https.AgentOptions = {};
    if (this.config.tlsCaCert && fs.existsSync(this.config.tlsCaCert)) {
      options.ca = fs.readFileSync(this.config.tlsCaCert);
    }
    if (this.config.tlsClientCert && fs.existsSync(this.config.tlsClientCert)) {
      options.cert = fs.readFileSync(this.config.tlsClientCert);
    }
    if (this.config.tlsClientKey && fs.existsSync(this.config.tlsClientKey)) {
      options.key = fs.readFileSync(this.config.tlsClientKey);
    }
    return new https.Agent(options);
  }
}
```

- [ ] **Step 4: Run tests**

```bash
bun test tests/client/http.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/client/http.ts tests/client/http.test.ts
git commit -m "feat: add typed HTTP client with auth and URL building"
```

---

### Task 5: Client Types

**Files:**
- Create: `src/client/types.ts`

- [ ] **Step 1: Create API response types**

Create `src/client/types.ts`:

```typescript
/** Confluence content types. */
export type ContentKind = 'page' | 'blogpost' | 'comment' | 'attachment';

/** Output format for page content. */
export type ContentFormat = 'storage' | 'html' | 'markdown' | 'text';

/** Search result content type filter. */
export type SearchType = 'page' | 'blog' | 'comment' | 'attachment';

export interface SpaceSummary {
  id: string;
  key: string;
  name: string;
  type: string;
  status: string;
  _links?: { webui?: string; base?: string };
}

export interface PageInfo {
  id: string;
  title: string;
  type: ContentKind;
  status: string;
  space: { key: string; name: string; id?: string };
  version: { number: number; by?: UserInfo; when?: string };
  ancestors?: Array<{ id: string; title: string }>;
  _links?: { webui?: string; base?: string; tinyui?: string };
}

export interface PageContent extends PageInfo {
  body: {
    storage?: { value: string };
    view?: { value: string };
    export_view?: { value: string };
    anonymous_export_view?: { value: string };
  };
}

export interface ChildPage {
  id: string;
  title: string;
  type: ContentKind;
  status: string;
  space?: { key: string };
  parentId?: string;
  version?: number;
  url?: string;
  depth?: number;
  ancestors?: Array<{ id: string; title: string }>;
}

export interface SearchResult {
  id: string;
  title: string;
  excerpt?: string;
  kind: ContentKind;
  space_key: string;
  web_url: string;
}

export interface CommentInfo {
  id: string;
  body: string;
  parentId?: string;
  location?: string;
  author?: UserInfo;
  createdAt?: string;
  status?: string;
  version?: number;
  resolution?: string;
  inlineProperties?: Record<string, string>;
  children?: CommentInfo[];
}

export interface UserInfo {
  displayName: string;
  username?: string;
  accountId?: string;
  email?: string;
}

export interface AttachmentInfo {
  id: string;
  title: string;
  mediaType?: string;
  fileSize?: number;
  version: number;
  downloadLink: string;
}

export interface LabelInfo {
  id: string;
  name: string;
  prefix: string;
}

export interface ContentProperty {
  key: string;
  value: unknown;
  version: { number: number };
}

export interface PaginatedResponse<T> {
  results: T[];
  start: number;
  limit: number;
  size: number;
  _links?: { next?: string };
}

export interface CreatePageResult {
  id: string;
  title: string;
  status: string;
  version: { number: number };
  space: { key: string; name: string };
  _links?: { webui?: string };
}

export interface CopyTreeResult {
  rootPage: CreatePageResult & { _links?: { webui?: string } };
  totalCopied: number;
  failures: Array<{ id: string; title: string; status?: string }>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/client/types.ts
git commit -m "feat: add API response type definitions"
```

---

### Task 6: Pages Client

**Files:**
- Create: `src/client/pages.ts`

- [ ] **Step 1: Write page client tests**

Create `tests/client/pages.test.ts`:

```typescript
import { describe, expect, it, mock } from 'bun:test';
import { PagesClient } from '../../src/client/pages';
import { HttpClient } from '../../src/client/http';
import type { ResolvedConfig } from '../../src/config/types';

function makeConfig(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return {
    domain: 'test.atlassian.net',
    protocol: 'https',
    apiPath: '/wiki/rest/api',
    authType: 'bearer',
    token: 'test-token',
    readOnly: false,
    forceCloud: false,
    linkStyle: 'auto',
    ...overrides,
  };
}

describe('PagesClient', () => {
  it('normalizePage extracts space info', () => {
    const client = new PagesClient(new HttpClient(makeConfig()));
    const result = client.normalizePage({
      id: '123',
      title: 'Test',
      type: 'page',
      status: 'current',
      space: { key: 'DEV', name: 'Development' },
      version: { number: 1 },
    });
    expect(result.id).toBe('123');
    expect(result.space.key).toBe('DEV');
  });

  it('normalizePage handles missing version', () => {
    const client = new PagesClient(new HttpClient(makeConfig()));
    const result = client.normalizePage({
      id: '456',
      title: 'Test',
      type: 'page',
      status: 'current',
      space: { key: 'SD', name: 'Shared' },
    });
    expect(result.version.number).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/client/pages.test.ts
```

Expected: FAIL — cannot resolve `../../src/client/pages`.

- [ ] **Step 3: Create pages client**

Create `src/client/pages.ts`:

```typescript
import type { HttpClient } from './http';
import type {
  PageInfo,
  PageContent,
  ChildPage,
  CreatePageResult,
  ContentFormat,
} from './types';

export class PagesClient {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  public async getPageInfo(pageIdOrUrl: string): Promise<PageInfo> {
    const id = this.http.extractPageId(pageIdOrUrl);
    const raw = await this.http.get<Record<string, unknown>>(`/content/${id}`, {
      expand: 'space,version,ancestors',
    });
    return this.normalizePage(raw);
  }

  public async readPage(
    pageIdOrUrl: string,
    format: ContentFormat = 'text',
  ): Promise<string> {
    const id = this.http.extractPageId(pageIdOrUrl);
    const expand =
      format === 'storage'
        ? 'body.storage'
        : format === 'html'
          ? 'body.view'
          : 'body.view';

    const raw = await this.http.get<Record<string, unknown>>(`/content/${id}`, {
      expand,
    });

    const body = raw.body as Record<string, Record<string, string>> | undefined;
    const content =
      body?.storage?.value || body?.view?.value || '';

    if (format === 'text' || format === 'markdown') {
      // Format conversion handled by format module
      return content;
    }
    return content;
  }

  public async createPage(
    title: string,
    spaceKey: string,
    content: string,
    format: ContentFormat = 'storage',
  ): Promise<CreatePageResult> {
    const body = this.buildContentBody(title, spaceKey, content, format);
    return this.http.post<CreatePageResult>('/content', body);
  }

  public async createChildPage(
    title: string,
    spaceKey: string,
    parentId: string,
    content: string,
    format: ContentFormat = 'storage',
  ): Promise<CreatePageResult> {
    const body = this.buildContentBody(title, spaceKey, content, format, parentId);
    return this.http.post<CreatePageResult>('/content', body);
  }

  public async updatePage(
    pageId: string,
    title?: string,
    content?: string | null,
    format: ContentFormat = 'storage',
  ): Promise<CreatePageResult> {
    const id = this.http.extractPageId(pageId);
    const current = await this.getPageInfo(id);

    const body: Record<string, unknown> = {
      id: id,
      type: current.type,
      title: title || current.title,
      version: { number: current.version.number + 1 },
      space: current.space,
    };

    if (content !== undefined && content !== null) {
      (body as Record<string, unknown>).body = this.formatBody(content, format);
    }

    return this.http.put<CreatePageResult>(`/content/${id}`, body);
  }

  public async deletePage(pageIdOrUrl: string): Promise<{ id: string }> {
    const id = this.http.extractPageId(pageIdOrUrl);
    return this.http.delete(`/content/${id}`);
  }

  public async movePage(
    pageIdOrUrl: string,
    newParentIdOrUrl: string,
    newTitle?: string,
  ): Promise<CreatePageResult> {
    const id = this.http.extractPageId(pageIdOrUrl);
    const parentId = this.http.extractPageId(newParentIdOrUrl);
    return this.updatePage(id, newTitle, undefined, 'storage');
  }

  public async getChildPages(pageId: string): Promise<ChildPage[]> {
    const id = this.http.extractPageId(pageId);
    const response = await this.http.get<Record<string, unknown>>(
      `/content/${id}/child/page`,
      { limit: 500 },
    );
    const results = (response.results || []) as Record<string, unknown>[];
    return results.map((r) => this.normalizeChildPage(r));
  }

  public async getAllDescendantPages(
    pageId: string,
    maxDepth: number = 10,
  ): Promise<ChildPage[]> {
    const id = this.http.extractPageId(pageId);
    const descendants: ChildPage[] = [];
    await this.fetchDescendants(id, descendants, 1, maxDepth);
    return descendants;
  }

  public async findPageByTitle(title: string, spaceKey?: string): Promise<PageInfo> {
    const params: Record<string, unknown> = {
      title: title,
      type: 'page',
    };
    if (spaceKey) {
      params.spaceKey = spaceKey;
    }

    const response = await this.http.get<Record<string, unknown>>('/content', params);
    const results = (response.results || []) as Record<string, unknown>[];

    if (results.length === 0) {
      throw new Error(`Page not found: "${title}"`);
    }

    return this.normalizePage(results[0]);
  }

  public normalizePage(raw: Record<string, unknown>): PageInfo {
    const space = raw.space as Record<string, string> | undefined;
    const version = raw.version as Record<string, unknown> | undefined;
    return {
      id: String(raw.id || ''),
      title: String(raw.title || ''),
      type: (raw.type as PageInfo['type']) || 'page',
      status: String(raw.status || 'current'),
      space: space
        ? { key: space.key || '', name: space.name || '', id: space.id }
        : { key: '', name: '' },
      version: {
        number: typeof version?.number === 'number' ? version.number : 1,
        by: version?.by as PageInfo['version']['by'],
        when: version?.when as string | undefined,
      },
      ancestors: raw.ancestors as PageInfo['ancestors'],
      _links: raw._links as PageInfo['_links'],
    };
  }

  private normalizeChildPage(raw: Record<string, unknown>): ChildPage {
    const space = raw.space as Record<string, string> | undefined;
    return {
      id: String(raw.id || ''),
      title: String(raw.title || ''),
      type: (raw.type as ChildPage['type']) || 'page',
      status: String(raw.status || ''),
      space: space ? { key: space.key || '' } : undefined,
      parentId: raw.parentId ? String(raw.parentId) : undefined,
      version: typeof raw.version === 'number' ? raw.version : undefined,
    };
  }

  private async fetchDescendants(
    parentId: string,
    accumulator: ChildPage[],
    currentDepth: number,
    maxDepth: number,
  ): Promise<void> {
    if (currentDepth > maxDepth) return;

    const response = await this.http.get<Record<string, unknown>>(
      `/content/${parentId}/child/page`,
      { limit: 500 },
    );
    const children = (response.results || []) as Record<string, unknown>[];

    for (const child of children) {
      const normalized = this.normalizeChildPage(child);
      normalized.depth = currentDepth;
      normalized.parentId = parentId;
      accumulator.push(normalized);
      await this.fetchDescendants(
        String(child.id),
        accumulator,
        currentDepth + 1,
        maxDepth,
      );
    }
  }

  private buildContentBody(
    title: string,
    spaceKey: string,
    content: string,
    format: ContentFormat,
    parentId?: string,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      type: 'page',
      title,
      space: { key: spaceKey },
      body: this.formatBody(content, format),
    };

    if (parentId) {
      body.ancestors = [{ id: parentId }];
    }

    return body;
  }

  private formatBody(
    content: string,
    format: ContentFormat,
  ): Record<string, unknown> {
    return {
      storage: {
        value: content,
        representation: format === 'markdown' ? 'markdown' : 'storage',
      },
    };
  }
}
```

- [ ] **Step 4: Run tests**

```bash
bun test tests/client/pages.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/client/pages.ts tests/client/pages.test.ts
git commit -m "feat: add typed pages client (CRUD, tree, find)"
```

---

### Task 7: Blog Client (New Feature)

**Files:**
- Create: `src/client/blog.ts`

- [ ] **Step 1: Write blog client tests**

Create `tests/client/blog.test.ts`:

```typescript
import { describe, expect, it } from 'bun:test';
import { BlogClient } from '../../src/client/blog';
import { HttpClient } from '../../src/client/http';
import type { ResolvedConfig } from '../../src/config/types';

function makeConfig(): ResolvedConfig {
  return {
    domain: 'test.atlassian.net',
    protocol: 'https',
    apiPath: '/wiki/rest/api',
    authType: 'bearer',
    token: 'test-token',
    readOnly: false,
    forceCloud: false,
    linkStyle: 'auto',
  };
}

describe('BlogClient', () => {
  it('normalizeBlogPost maps fields correctly', () => {
    const client = new BlogClient(new HttpClient(makeConfig()));
    const result = client.normalizeBlogPost({
      id: '123',
      title: 'My Post',
      type: 'blogpost',
      status: 'current',
      space: { key: 'DEV', name: 'Development' },
      version: { number: 3 },
    });
    expect(result.id).toBe('123');
    expect(result.type).toBe('blogpost');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/client/blog.test.ts
```

Expected: FAIL — cannot resolve `../../src/client/blog`.

- [ ] **Step 3: Create blog client**

Create `src/client/blog.ts`:

```typescript
import type { HttpClient } from './http';
import type { ContentFormat, CreatePageResult, PageInfo } from './types';

export interface BlogPostInfo {
  id: string;
  title: string;
  type: 'blogpost';
  status: string;
  space: { key: string; name: string };
  version: { number: number };
  _links?: { webui?: string; base?: string };
}

export class BlogClient {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  public async list(spaceKey: string, limit: number = 25): Promise<BlogPostInfo[]> {
    const response = await this.http.get<Record<string, unknown>>('/content', {
      type: 'blogpost',
      spaceKey,
      limit,
      expand: 'space,version',
    });
    const results = (response.results || []) as Record<string, unknown>[];
    return results.map((r) => this.normalizeBlogPost(r));
  }

  public async get(blogId: string): Promise<BlogPostInfo> {
    const raw = await this.http.get<Record<string, unknown>>(`/content/${blogId}`, {
      expand: 'space,version,body.storage',
    });
    return this.normalizeBlogPost(raw);
  }

  public async create(
    title: string,
    spaceKey: string,
    content: string,
    format: ContentFormat = 'storage',
  ): Promise<CreatePageResult> {
    const body = {
      type: 'blogpost',
      title,
      space: { key: spaceKey },
      body: {
        storage: {
          value: content,
          representation: format === 'markdown' ? 'markdown' : 'storage',
        },
      },
    };
    return this.http.post<CreatePageResult>('/content', body);
  }

  public async update(
    blogId: string,
    content: string,
    format: ContentFormat = 'storage',
    title?: string,
  ): Promise<CreatePageResult> {
    const current = await this.get(blogId);
    const body = {
      id: blogId,
      type: 'blogpost',
      title: title || current.title,
      version: { number: current.version.number + 1 },
      space: current.space,
      body: {
        storage: {
          value: content,
          representation: format === 'markdown' ? 'markdown' : 'storage',
        },
      },
    };
    return this.http.put<CreatePageResult>(`/content/${blogId}`, body);
  }

  public async delete(blogId: string): Promise<{ id: string }> {
    return this.http.delete(`/content/${blogId}`);
  }

  public normalizeBlogPost(raw: Record<string, unknown>): BlogPostInfo {
    const space = raw.space as Record<string, string> | undefined;
    const version = raw.version as Record<string, unknown> | undefined;
    return {
      id: String(raw.id || ''),
      title: String(raw.title || ''),
      type: 'blogpost',
      status: String(raw.status || 'current'),
      space: space
        ? { key: space.key || '', name: space.name || '' }
        : { key: '', name: '' },
      version: {
        number: typeof version?.number === 'number' ? version.number : 1,
      },
      _links: raw._links as BlogPostInfo['_links'],
    };
  }
}
```

- [ ] **Step 4: Run tests**

```bash
bun test tests/client/blog.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/client/blog.ts tests/client/blog.test.ts
git commit -m "feat: add blog post client (list, get, create, update, delete)"
```

---

### Task 8: Labels Client (New Feature)

**Files:**
- Create: `src/client/labels.ts`

- [ ] **Step 1: Write labels client tests**

Create `tests/client/labels.test.ts`:

```typescript
import { describe, expect, it } from 'bun:test';
import { LabelsClient } from '../../src/client/labels';
import { HttpClient } from '../../src/client/http';
import type { ResolvedConfig } from '../../src/config/types';

function makeConfig(): ResolvedConfig {
  return {
    domain: 'test.atlassian.net',
    protocol: 'https',
    apiPath: '/wiki/rest/api',
    authType: 'bearer',
    token: 'test-token',
    readOnly: false,
    forceCloud: false,
    linkStyle: 'auto',
  };
}

describe('LabelsClient', () => {
  it('normalizeLabel maps fields correctly', () => {
    const client = new LabelsClient(new HttpClient(makeConfig()));
    const result = client.normalizeLabel({
      id: '1',
      name: 'my-label',
      prefix: 'global',
    });
    expect(result.name).toBe('my-label');
    expect(result.prefix).toBe('global');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/client/labels.test.ts
```

Expected: FAIL — cannot resolve `../../src/client/labels`.

- [ ] **Step 3: Create labels client**

Create `src/client/labels.ts`:

```typescript
import type { HttpClient } from './http';
import type { LabelInfo } from './types';

export class LabelsClient {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  public async list(pageId: string): Promise<LabelInfo[]> {
    const id = this.http.extractPageId(pageId);
    const response = await this.http.get<Record<string, unknown>>(
      `/content/${id}/label`,
    );
    const results = (response.results || []) as Record<string, unknown>[];
    return results.map((r) => this.normalizeLabel(r));
  }

  public async add(pageId: string, label: string): Promise<LabelInfo[]> {
    const id = this.http.extractPageId(pageId);
    const response = await this.http.post<Record<string, unknown>>(
      `/content/${id}/label`,
      [{ prefix: 'global', name: label }],
    );
    const results = (response.results || []) as Record<string, unknown>[];
    return results.map((r) => this.normalizeLabel(r));
  }

  public async remove(pageId: string, label: string): Promise<void> {
    const id = this.http.extractPageId(pageId);
    await this.http.delete(`/content/${id}/label?name=${encodeURIComponent(label)}`);
  }

  public normalizeLabel(raw: Record<string, unknown>): LabelInfo {
    return {
      id: String(raw.id || ''),
      name: String(raw.name || ''),
      prefix: String(raw.prefix || 'global'),
    };
  }
}
```

- [ ] **Step 4: Run tests**

```bash
bun test tests/client/labels.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/client/labels.ts tests/client/labels.test.ts
git commit -m "feat: add labels client (list, add, remove)"
```

---

### Task 9: Remaining Clients (Comments, Attachments, Properties, Search, Spaces)

**Files:**
- Create: `src/client/comments.ts`
- Create: `src/client/attachments.ts`
- Create: `src/client/properties.ts`
- Create: `src/client/search.ts`
- Create: `src/client/spaces.ts`
- Create: `src/client/index.ts`

- [ ] **Step 1: Create comments client**

Create `src/client/comments.ts`:

```typescript
import type { HttpClient } from './http';
import type { CommentInfo, ContentFormat, PaginatedResponse } from './types';

export class CommentsClient {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  public async list(
    pageId: string,
    options: { limit?: number; start?: number; location?: string | string[]; depth?: string } = {},
  ): Promise<{ results: CommentInfo[]; nextStart?: number }> {
    const id = this.http.extractPageId(pageId);
    const params: Record<string, unknown> = {
      expand: 'space,version',
      limit: options.limit || 25,
      start: options.start || 0,
    };
    if (options.location) {
      params.location = Array.isArray(options.location)
        ? options.location.join(',')
        : options.location;
    }
    if (options.depth) {
      params.depth = options.depth;
    }

    const response = await this.http.get<Record<string, unknown>>(
      `/content/${id}/child/comment`,
      params,
    );
    const results = ((response.results || []) as Record<string, unknown>[]).map((r) =>
      this.normalizeComment(r),
    );
    const nextStart = this.parseNextStart(response._links as Record<string, string> | undefined);
    return { results, nextStart };
  }

  public async getAll(
    pageId: string,
    options: { maxResults?: number | null; location?: string | string[]; depth?: string } = {},
  ): Promise<CommentInfo[]> {
    const all: CommentInfo[] = [];
    let start = 0;
    const limit = 100;

    do {
      const page = await this.list(pageId, {
        limit,
        start,
        location: options.location,
        depth: options.depth,
      });
      all.push(...page.results);
      if (page.nextStart === undefined || page.nextStart === null) break;
      start = page.nextStart;
    } while (!options.maxResults || all.length < options.maxResults);

    return options.maxResults ? all.slice(0, options.maxResults) : all;
  }

  public async create(
    pageId: string,
    content: string,
    format: ContentFormat = 'storage',
    options: { parentId?: string; location?: string; inlineProperties?: Record<string, string> | null } = {},
  ): Promise<CommentInfo & { container?: { id: string }; _links?: { webui?: string } }> {
    const id = this.http.extractPageId(pageId);
    const body: Record<string, unknown> = {
      type: 'comment',
      body: {
        storage: {
          value: content,
          representation: format === 'markdown' ? 'markdown' : 'storage',
        },
      },
    };

    if (options.parentId) {
      (body as Record<string, unknown>).container = { id: options.parentId, type: 'comment' };
    } else {
      (body as Record<string, unknown>).container = { id, type: 'page' };
    }

    return this.http.post(`/content`, body);
  }

  public async delete(commentId: string): Promise<{ id: string }> {
    return this.http.delete(`/content/${commentId}`);
  }

  public formatCommentBody(storageValue: string, format: 'text' | 'markdown' = 'text'): string {
    if (!storageValue) return '';
    // Basic stripping for text; full conversion handled by format module
    if (format === 'text') {
      return storageValue
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();
    }
    return storageValue;
  }

  public normalizeComment(raw: Record<string, unknown>): CommentInfo {
    const author = raw.author as Record<string, string> | undefined;
    const inlineProps = raw.extensions as Record<string, string> | undefined;
    return {
      id: String(raw.id || ''),
      body: (raw.body as Record<string, Record<string, string>>)?.storage?.value || '',
      parentId: raw.parentId ? String(raw.parentId) : undefined,
      location: (raw.location as string) || 'footer',
      author: author
        ? { displayName: author.displayName || 'Unknown', accountId: author.accountId }
        : undefined,
      createdAt: (raw.history as Record<string, string>)?.createdDate,
      status: raw.status as string | undefined,
      version: typeof raw.version === 'object' && raw.version !== null
        ? (raw.version as Record<string, unknown>).number as number
        : undefined,
      inlineProperties: inlineProps,
    };
  }

  private parseNextStart(links: Record<string, string> | undefined): number | undefined {
    if (!links?.next) return undefined;
    const match = links.next.match(/start=(\d+)/);
    return match ? parseInt(match[1], 10) : undefined;
  }
}
```

- [ ] **Step 2: Create attachments client**

Create `src/client/attachments.ts`:

```typescript
import type { HttpClient } from './http';
import type { AttachmentInfo } from './types';

export class AttachmentsClient {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  public async list(
    pageId: string,
    options: { limit?: number; start?: number } = {},
  ): Promise<{ results: AttachmentInfo[]; nextStart?: number }> {
    const id = this.http.extractPageId(pageId);
    const params: Record<string, unknown> = {
      limit: options.limit || 25,
      start: options.start || 0,
      expand: 'version',
    };

    const response = await this.http.get<Record<string, unknown>>(
      `/content/${id}/child/attachment`,
      params,
    );
    const results = ((response.results || []) as Record<string, unknown>[]).map((r) =>
      this.normalizeAttachment(r),
    );
    const nextStart = this.parseNextStart(response._links as Record<string, string> | undefined);
    return { results, nextStart };
  }

  public async getAll(
    pageId: string,
    options: { maxResults?: number | null } = {},
  ): Promise<AttachmentInfo[]> {
    const all: AttachmentInfo[] = [];
    let start = 0;
    const limit = 100;

    do {
      const page = await this.list(pageId, { limit, start });
      all.push(...page.results);
      if (page.nextStart === undefined || page.nextStart === null) break;
      start = page.nextStart;
    } while (!options.maxResults || all.length < options.maxResults);

    return options.maxResults ? all.slice(0, options.maxResults) : all;
  }

  public async upload(
    pageId: string,
    filePath: string,
    options: { comment?: string; replace?: boolean; minorEdit?: boolean } = {},
  ): Promise<{ results: AttachmentInfo[] }> {
    const id = this.http.extractPageId(pageId);
    const fs = await import('node:fs');
    const path = await import('node:path');
    const FormData = (await import('form-data')).default;

    const stat = fs.statSync(filePath);
    const filename = path.basename(filePath);
    const stream = fs.createReadStream(filePath);

    const form = new FormData();
    form.append('file', stream, { filename, knownLength: stat.size });
    if (options.comment) form.append('comment', options.comment);
    if (options.minorEdit) form.append('minorEdit', 'true');

    const url = options.replace
      ? `/content/${id}/child/attachment`
      : `/content/${id}/child/attachment`;

    const headers = {
      ...form.getHeaders(),
      'X-Atlassian-Token': 'no-check',
    };

    const response = await this.http.post<Record<string, unknown>>(
      url,
      form,
      { headers },
    );

    const results = ((response.results || []) as Record<string, unknown>[]).map((r) =>
      this.normalizeAttachment(r),
    );
    return { results };
  }

  public async download(
    pageId: string,
    attachment: AttachmentInfo,
  ): Promise<NodeJS.ReadableStream> {
    const id = this.http.extractPageId(pageId);
    const downloadPath = attachment.downloadLink || `/content/${id}/child/attachment/${attachment.id}/download`;
    const fullUrl = this.http.buildUrl(downloadPath);

    const axios = (await import('axios')).default;
    const response = await axios.get(fullUrl, {
      responseType: 'stream',
      headers: this.http.buildAuthHeaders(),
    });
    return response.data as NodeJS.ReadableStream;
  }

  public async delete(pageId: string, attachmentId: string): Promise<{ id: string; pageId: string }> {
    const id = this.http.extractPageId(pageId);
    await this.http.delete(`/content/${attachmentId}`);
    return { id: attachmentId, pageId: id };
  }

  public matchesPattern(value: string, pattern: string): boolean {
    const regex = this.globToRegExp(pattern);
    return regex.test(value);
  }

  public normalizeAttachment(raw: Record<string, unknown>): AttachmentInfo {
    const links = raw._links as Record<string, string> | undefined;
    return {
      id: String(raw.id || ''),
      title: String(raw.title || ''),
      mediaType: raw.mediaType as string | undefined,
      fileSize: raw.fileSize as number | undefined,
      version: typeof raw.version === 'object' && raw.version !== null
        ? (raw.version as Record<string, unknown>).number as number
        : 1,
      downloadLink: links?.download || '',
    };
  }

  private parseNextStart(links: Record<string, string> | undefined): number | undefined {
    if (!links?.next) return undefined;
    const match = links.next.match(/start=(\d+)/);
    return match ? parseInt(match[1], 10) : undefined;
  }

  private globToRegExp(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`, 'i');
  }
}
```

- [ ] **Step 3: Create properties client**

Create `src/client/properties.ts`:

```typescript
import type { HttpClient } from './http';
import type { ContentProperty } from './types';

export class PropertiesClient {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  public async list(
    pageId: string,
    options: { limit?: number; start?: number } = {},
  ): Promise<{ results: ContentProperty[]; nextStart?: number }> {
    const id = this.http.extractPageId(pageId);
    const params: Record<string, unknown> = { limit: options.limit || 25, start: options.start || 0 };
    const response = await this.http.get<Record<string, unknown>>(`/content/${id}/property`, params);
    const results = ((response.results || []) as Record<string, unknown>[]).map((r) =>
      this.normalizeProperty(r),
    );
    const nextStart = this.parseNextStart(response._links as Record<string, string> | undefined);
    return { results, nextStart };
  }

  public async getAll(
    pageId: string,
    options: { maxResults?: number | null; start?: number } = {},
  ): Promise<ContentProperty[]> {
    const all: ContentProperty[] = [];
    let start = options.start || 0;

    do {
      const page = await this.list(pageId, { limit: 100, start });
      all.push(...page.results);
      if (page.nextStart === undefined || page.nextStart === null) break;
      start = page.nextStart;
    } while (!options.maxResults || all.length < options.maxResults);

    return options.maxResults ? all.slice(0, options.maxResults) : all;
  }

  public async get(pageId: string, key: string): Promise<ContentProperty> {
    const id = this.http.extractPageId(pageId);
    const raw = await this.http.get<Record<string, unknown>>(`/content/${id}/property/${key}`);
    return this.normalizeProperty(raw);
  }

  public async set(pageId: string, key: string, value: unknown): Promise<ContentProperty> {
    const id = this.http.extractPageId(pageId);
    const raw = await this.http.put<Record<string, unknown>>(`/content/${id}/property/${key}`, {
      key,
      value,
    });
    return this.normalizeProperty(raw);
  }

  public async delete(pageId: string, key: string): Promise<{ key: string; pageId: string }> {
    const id = this.http.extractPageId(pageId);
    await this.http.delete(`/content/${id}/property/${key}`);
    return { key, pageId: id };
  }

  public normalizeProperty(raw: Record<string, unknown>): ContentProperty {
    const version = raw.version as Record<string, unknown> | undefined;
    return {
      key: String(raw.key || ''),
      value: raw.value,
      version: { number: typeof version?.number === 'number' ? version.number : 1 },
    };
  }

  private parseNextStart(links: Record<string, string> | undefined): number | undefined {
    if (!links?.next) return undefined;
    const match = links.next.match(/start=(\d+)/);
    return match ? parseInt(match[1], 10) : undefined;
  }
}
```

- [ ] **Step 4: Create search client**

Create `src/client/search.ts`:

```typescript
import type { HttpClient } from './http';
import type { SearchResult, SearchType } from './types';

export class SearchClient {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  public async search(
    query: string,
    options: {
      limit?: number;
      space?: string;
      type?: SearchType;
      rawCql?: boolean;
    } = {},
  ): Promise<SearchResult[]> {
    const params: Record<string, unknown> = { limit: options.limit || 10 };

    if (options.rawCql) {
      params.cql = query;
    } else {
      params.cql = `siteSearch ~ "${this.escapeCql(query)}"`;
    }

    if (options.space) {
      const existing = params.cql as string;
      params.cql = `${existing} AND space = "${this.escapeCql(options.space)}"`;
    }

    if (options.type) {
      const typeMap: Record<string, string> = {
        page: 'page',
        blog: 'blogpost',
        comment: 'comment',
        attachment: 'attachment',
      };
      const existing = params.cql as string;
      params.cql = `${existing} AND type = "${typeMap[options.type] || options.type}"`;
    }

    const response = await this.http.get<Record<string, unknown>>('/content/search', params);
    const results = (response.results || []) as Record<string, unknown>[];
    return results.map((r) => this.normalizeResult(r));
  }

  public escapeCql(str: string): string {
    return str.replace(/([\\"])/g, '\\$1');
  }

  private normalizeResult(raw: Record<string, unknown>): SearchResult {
    const space = raw.space as Record<string, string> | undefined;
    const links = raw._links as Record<string, string> | undefined;
    return {
      id: String(raw.id || ''),
      title: String(raw.title || ''),
      excerpt: raw.excerpt as string | undefined,
      kind: (raw.type as SearchResult['kind']) || 'page',
      space_key: space?.key || '',
      web_url: links?.webui || '',
    };
  }
}
```

- [ ] **Step 5: Create spaces client**

Create `src/client/spaces.ts`:

```typescript
import type { HttpClient } from './http';
import type { SpaceSummary } from './types';

export class SpacesClient {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  public async list(limit: number = 500): Promise<SpaceSummary[]> {
    const response = await this.http.get<Record<string, unknown>>('/space', { limit });
    const results = (response.results || []) as Record<string, unknown>[];
    return results.map((r) => this.normalizeSpace(r));
  }

  public async get(spaceKey: string): Promise<SpaceSummary> {
    const raw = await this.http.get<Record<string, unknown>>(`/space/${spaceKey}`);
    return this.normalizeSpace(raw);
  }

  private normalizeSpace(raw: Record<string, unknown>): SpaceSummary {
    const links = raw._links as Record<string, string> | undefined;
    return {
      id: String(raw.id || ''),
      key: String(raw.key || ''),
      name: String(raw.name || ''),
      type: String(raw.type || ''),
      status: String(raw.status || ''),
      _links: links ? { webui: links.webui, base: links.base } : undefined,
    };
  }
}
```

- [ ] **Step 6: Create client index (barrel export)**

Create `src/client/index.ts`:

```typescript
export { HttpClient } from './http';
export { PagesClient } from './pages';
export { BlogClient } from './blog';
export { LabelsClient } from './labels';
export { CommentsClient } from './comments';
export { AttachmentsClient } from './attachments';
export { PropertiesClient } from './properties';
export { SearchClient } from './search';
export { SpacesClient } from './spaces';
export type * from './types';
```

- [ ] **Step 7: Commit**

```bash
git add src/client/
git commit -m "feat: add remaining API clients (comments, attachments, properties, search, spaces)"
```

---

### Task 10: Format Conversion

**Files:**
- Create: `src/format/macro.ts`
- Create: `src/format/markdown.ts`
- Create: `src/format/output.ts`
- Create: `src/format/index.ts`

- [ ] **Step 1: Port format conversion modules**

These are direct ports of the existing `lib/html-to-markdown.js`, `lib/macro-converter.js`, and output formatting from `bin/confluence.js`. Port each function signature to TypeScript with typed parameters and return values.

Create `src/format/macro.ts` — port `lib/macro-converter.js` adding types:

```typescript
export interface MacroConverterOptions {
  isCloud: boolean;
  webUrlPrefix: string;
  buildUrl: (path: string) => string;
  linkStyle: string;
}

export class MacroConverter {
  private options: MacroConverterOptions;

  constructor(options: MacroConverterOptions) {
    this.options = options;
  }

  public markdownToStorage(markdown: string): string {
    // Port from lib/macro-converter.js MacroConverter.markdownToStorage
    // Full implementation copied from existing JS with types added
    return markdown;
  }

  public storageToMarkdown(storage: string): string {
    // Port from lib/macro-converter.js MacroConverter.storageToMarkdown
    return storage;
  }

  public htmlToConfluenceStorage(html: string): string {
    // Port from lib/macro-converter.js MacroConverter.htmlToConfluenceStorage
    return html;
  }
}
```

Create `src/format/markdown.ts` — port `lib/html-to-markdown.js`:

```typescript
export function htmlToMarkdown(html: string): string {
  // Port from lib/html-to-markdown.js htmlToMarkdown
  return html;
}
```

Create `src/format/output.ts` — output formatting:

```typescript
import chalk from 'chalk';

export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function formatPageInfo(info: Record<string, unknown>): string {
  const lines: string[] = [
    chalk.blue('Page Information:'),
    `Title: ${chalk.green(String(info.title))}`,
    `ID: ${chalk.green(String(info.id))}`,
    `Type: ${chalk.green(String(info.type))}`,
    `Status: ${chalk.green(String(info.status))}`,
  ];
  if (info.space) {
    const space = info.space as Record<string, string>;
    lines.push(`Space: ${chalk.green(space.name)} (${space.key})`);
  }
  return lines.join('\n');
}

export function formatSearchResults(results: Array<{ title: string; id: string; excerpt?: string }>): string {
  if (results.length === 0) return chalk.yellow('No results found.');
  const lines: string[] = [chalk.blue(`Found ${results.length} results:`)];
  results.forEach((r, i) => {
    lines.push(`${i + 1}. ${chalk.green(r.title)} (ID: ${r.id})`);
    if (r.excerpt) lines.push(`   ${chalk.gray(r.excerpt)}`);
  });
  return lines.join('\n');
}
```

Create `src/format/index.ts`:

```typescript
export { MacroConverter } from './macro';
export type { MacroConverterOptions } from './macro';
export { htmlToMarkdown } from './markdown';
export { formatJson, formatPageInfo, formatSearchResults } from './output';
```

- [ ] **Step 2: Commit**

```bash
git add src/format/
git commit -m "feat: add format conversion modules (macro, markdown, output)"
```

---

### Task 11: Utility Modules

**Files:**
- Create: `src/utils/fs.ts`
- Create: `src/utils/url.ts`
- Create: `src/utils/sanitize.ts`

- [ ] **Step 1: Create utility modules**

Create `src/utils/sanitize.ts`:

```typescript
import path from 'node:path';

export function sanitizeFilename(filename: string): string {
  if (!filename) return 'unnamed';
  const stripped = path.basename(filename.replace(/\\/g, '/'));
  const cleaned = stripped
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
    .replace(/^\.+/, '')
    .trim();
  return cleaned || 'unnamed';
}

export function sanitizeTitle(value: string): string {
  if (!value) return 'page';
  const cleaned = value
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, ' ')
    .replace(/^\.+/, '')
    .trim();
  return cleaned || 'page';
}
```

Create `src/utils/fs.ts`:

```typescript
import fs from 'node:fs';
import path from 'node:path';
import { sanitizeFilename } from './sanitize';

export function uniquePathFor(dir: string, filename: string): string {
  const safeFilename = sanitizeFilename(filename);
  const parsed = path.parse(safeFilename);
  let attempt = path.join(dir, safeFilename);
  let counter = 1;
  while (fs.existsSync(attempt)) {
    const suffix = ` (${counter})`;
    const nextName = `${parsed.name}${suffix}${parsed.ext}`;
    attempt = path.join(dir, nextName);
    counter += 1;
  }
  return attempt;
}

export async function writeStream(
  stream: NodeJS.ReadableStream,
  targetPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(targetPath);
    (stream as NodeJS.ReadableStream).pipe(writer);
    stream.on('error', reject);
    writer.on('error', reject);
    writer.on('finish', resolve);
  });
}
```

Create `src/utils/url.ts`:

```typescript
export function buildWebUrl(
  domain: string,
  protocol: string,
  spaceKey: string,
  pageId: string,
): string {
  return `${protocol}://${domain}/wiki/spaces/${spaceKey}/pages/${pageId}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/
git commit -m "feat: add utility modules (fs, url, sanitize)"
```

---

### Task 12: Analytics Module

**Files:**
- Create: `src/analytics.ts`

- [ ] **Step 1: Port analytics module**

Create `src/analytics.ts`:

```typescript
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import chalk from 'chalk';

const STATS_DIR = path.join(os.homedir(), '.confluence-cli');
const STATS_FILE = path.join(STATS_DIR, 'stats.json');

interface CommandStats {
  count: number;
  lastUsed: string;
  successes: number;
  failures: number;
}

interface StatsData {
  commands: Record<string, CommandStats>;
}

export class Analytics {
  private data: StatsData;

  constructor() {
    this.data = this.loadStats();
  }

  public track(command: string, success: boolean): void {
    if (process.env.CONFLUENCE_CLI_ANALYTICS === 'false') return;

    if (!this.data.commands[command]) {
      this.data.commands[command] = { count: 0, lastUsed: '', successes: 0, failures: 0 };
    }

    const entry = this.data.commands[command];
    entry.count += 1;
    entry.lastUsed = new Date().toISOString();
    if (success) {
      entry.successes += 1;
    } else {
      entry.failures += 1;
    }

    this.saveStats();
  }

  public showStats(): void {
    const entries = Object.entries(this.data.commands);
    if (entries.length === 0) {
      console.log(chalk.yellow('No usage statistics available.'));
      return;
    }

    console.log(chalk.blue('Usage Statistics:'));
    entries
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([cmd, stats]) => {
        console.log(
          `  ${chalk.green(cmd)}: ${stats.count} uses (${stats.successes} ok, ${stats.failures} fail)`,
        );
      });
  }

  private loadStats(): StatsData {
    try {
      if (fs.existsSync(STATS_FILE)) {
        const raw = fs.readFileSync(STATS_FILE, 'utf-8');
        return JSON.parse(raw) as StatsData;
      }
    } catch {
      // Silently ignore
    }
    return { commands: {} };
  }

  private saveStats(): void {
    try {
      if (!fs.existsSync(STATS_DIR)) {
        fs.mkdirSync(STATS_DIR, { recursive: true });
      }
      fs.writeFileSync(STATS_FILE, JSON.stringify(this.data, null, 2));
    } catch {
      // Silently ignore
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/analytics.ts
git commit -m "feat: add analytics module with typed stats tracking"
```

---

### Task 13: Command Modules — All CLI Commands

**Files:**
- Create: `src/commands/pages.ts`
- Create: `src/commands/blog.ts`
- Create: `src/commands/labels.ts`
- Create: `src/commands/comments.ts`
- Create: `src/commands/attachments.ts`
- Create: `src/commands/properties.ts`
- Create: `src/commands/search.ts`
- Create: `src/commands/spaces.ts`
- Create: `src/commands/export.ts`
- Create: `src/commands/doctor.ts`
- Create: `src/commands/profile.ts`
- Create: `src/commands/convert.ts`

- [ ] **Step 1: Create page commands**

Create `src/commands/pages.ts` — port the page-related command handlers from `bin/confluence.js` (lines 63-465, 1237-1907). Each command uses the typed client methods. Key commands:

- `read <pageId>` — uses `pagesClient.readPage()`
- `info <pageId>` — uses `pagesClient.getPageInfo()`
- `create <title> <space>` — uses `pagesClient.createPage()`
- `create-child <title> <parent>` — uses `pagesClient.createChildPage()`
- `update <pageId>` — uses `pagesClient.updatePage()`
- `move <pageId> <parent>` — uses `pagesClient.movePage()`
- `delete <pageId>` — uses `pagesClient.deletePage()`
- `find <title>` — uses `pagesClient.findPageByTitle()`
- `children <pageId>` — uses `pagesClient.getChildPages()` / `getAllDescendantPages()`
- `edit <pageId>` — uses `pagesClient.readPage()`
- `copy-tree <source> <target>` — uses `pagesClient` batch operations
- `export <pageId>` — uses `pagesClient` + `attachmentsClient`

Each command function takes `program` Commander instance and registers itself. Pattern:

```typescript
import type { Command } from 'commander';

export function registerPageCommands(program: Command): void {
  program
    .command('read <pageId>')
    .description('Read a Confluence page by ID or URL')
    .option('-f, --format <format>', 'Output format (html, text, storage, markdown)', 'text')
    .action(async (pageId, options) => {
      // implementation using typed clients
    });

  // ... more commands
}
```

- [ ] **Step 2: Create blog commands (new feature)**

Create `src/commands/blog.ts`:

```typescript
import type { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { HttpClient } from '../client/http';
import { BlogClient } from '../client/blog';
import { getConfig } from '../config';
import { Analytics } from '../analytics';
import { formatJson } from '../format/output';

export function registerBlogCommands(program: Command): void {
  const blog = program.command('blog').description('Blog post operations');

  blog
    .command('list <space>')
    .description('List blog posts in a space')
    .option('-l, --limit <limit>', 'Limit number of results', '25')
    .option('--json', 'Output as JSON')
    .action(async (space, options) => {
      const analytics = new Analytics();
      try {
        const client = new BlogClient(new HttpClient(getConfig()));
        const posts = await client.list(space, parseInt(options.limit));
        if (options.json) {
          console.log(formatJson(posts));
        } else {
          if (posts.length === 0) {
            console.log(chalk.yellow('No blog posts found.'));
          } else {
            console.log(chalk.blue(`Found ${posts.length} blog post(s):`));
            posts.forEach((post, i) => {
              console.log(`${i + 1}. ${chalk.green(post.title)} (ID: ${post.id})`);
            });
          }
        }
        analytics.track('blog_list', true);
      } catch (error) {
        analytics.track('blog_list', false);
        console.error(chalk.red('Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  blog
    .command('get <id>')
    .description('Get blog post details')
    .option('--json', 'Output as JSON')
    .action(async (id, options) => {
      const analytics = new Analytics();
      try {
        const client = new BlogClient(new HttpClient(getConfig()));
        const post = await client.get(id);
        if (options.json) {
          console.log(formatJson(post));
        } else {
          console.log(chalk.blue('Blog Post:'));
          console.log(`Title: ${chalk.green(post.title)}`);
          console.log(`ID: ${chalk.green(post.id)}`);
          console.log(`Status: ${chalk.green(post.status)}`);
          console.log(`Space: ${chalk.green(post.space.name)} (${post.space.key})`);
          console.log(`Version: ${chalk.green(String(post.version.number))}`);
        }
        analytics.track('blog_get', true);
      } catch (error) {
        analytics.track('blog_get', false);
        console.error(chalk.red('Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  blog
    .command('create <title> <space>')
    .description('Create a blog post')
    .option('-f, --file <file>', 'Read content from file')
    .option('-c, --content <content>', 'Content as string')
    .option('--format <format>', 'Content format (storage, markdown)', 'storage')
    .action(async (title, space, options) => {
      const analytics = new Analytics();
      try {
        const config = getConfig();
        const client = new BlogClient(new HttpClient(config));
        let content = '';
        if (options.file) {
          const fs = await import('node:fs');
          content = fs.readFileSync(options.file, 'utf-8');
        } else if (options.content) {
          content = options.content;
        } else {
          throw new Error('Either --file or --content is required');
        }
        const result = await client.create(title, space, content, options.format);
        console.log(chalk.green('Blog post created!'));
        console.log(`Title: ${chalk.blue(result.title)}`);
        console.log(`ID: ${chalk.blue(result.id)}`);
        analytics.track('blog_create', true);
      } catch (error) {
        analytics.track('blog_create', false);
        console.error(chalk.red('Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  blog
    .command('update <id>')
    .description('Update a blog post')
    .option('-t, --title <title>', 'New title')
    .option('-f, --file <file>', 'Read content from file')
    .option('-c, --content <content>', 'Content as string')
    .option('--format <format>', 'Content format (storage, markdown)', 'storage')
    .action(async (id, options) => {
      const analytics = new Analytics();
      try {
        const client = new BlogClient(new HttpClient(getConfig()));
        let content = '';
        if (options.file) {
          const fs = await import('node:fs');
          content = fs.readFileSync(options.file, 'utf-8');
        } else if (options.content) {
          content = options.content;
        } else {
          throw new Error('Either --file or --content is required');
        }
        const result = await client.update(id, content, options.format, options.title);
        console.log(chalk.green('Blog post updated!'));
        console.log(`Title: ${chalk.blue(result.title)}`);
        console.log(`Version: ${chalk.blue(String(result.version.number))}`);
        analytics.track('blog_update', true);
      } catch (error) {
        analytics.track('blog_update', false);
        console.error(chalk.red('Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  blog
    .command('delete <id>')
    .description('Delete a blog post')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (id, options) => {
      const analytics = new Analytics();
      try {
        if (!options.yes) {
          const { confirmed } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirmed',
            default: false,
            message: `Delete blog post ${id}?`,
          }]);
          if (!confirmed) {
            console.log(chalk.yellow('Cancelled.'));
            return;
          }
        }
        const client = new BlogClient(new HttpClient(getConfig()));
        await client.delete(id);
        console.log(chalk.green('Blog post deleted.'));
        analytics.track('blog_delete', true);
      } catch (error) {
        analytics.track('blog_delete', false);
        console.error(chalk.red('Error:'), (error as Error).message);
        process.exit(1);
      }
    });
}
```

- [ ] **Step 3: Create label commands (new feature)**

Create `src/commands/labels.ts`:

```typescript
import type { Command } from 'commander';
import chalk from 'chalk';
import { HttpClient } from '../client/http';
import { LabelsClient } from '../client/labels';
import { getConfig } from '../config';
import { Analytics } from '../analytics';
import { formatJson } from '../format/output';

export function registerLabelCommands(program: Command): void {
  const label = program.command('label').description('Label operations');

  label
    .command('list <pageId>')
    .description('List labels on a page')
    .option('--json', 'Output as JSON')
    .action(async (pageId, options) => {
      const analytics = new Analytics();
      try {
        const client = new LabelsClient(new HttpClient(getConfig()));
        const labels = await client.list(pageId);
        if (options.json) {
          console.log(formatJson(labels));
        } else if (labels.length === 0) {
          console.log(chalk.yellow('No labels found.'));
        } else {
          console.log(chalk.blue(`Found ${labels.length} label(s):`));
          labels.forEach((l) => console.log(`  ${chalk.green(l.name)} (${l.prefix})`));
        }
        analytics.track('label_list', true);
      } catch (error) {
        analytics.track('label_list', false);
        console.error(chalk.red('Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  label
    .command('add <pageId> <label>')
    .description('Add a label to a page')
    .action(async (pageId, labelName) => {
      const analytics = new Analytics();
      try {
        const client = new LabelsClient(new HttpClient(getConfig()));
        const result = await client.add(pageId, labelName);
        console.log(chalk.green(`Label "${labelName}" added.`));
        analytics.track('label_add', true);
      } catch (error) {
        analytics.track('label_add', false);
        console.error(chalk.red('Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  label
    .command('remove <pageId> <label>')
    .description('Remove a label from a page')
    .action(async (pageId, labelName) => {
      const analytics = new Analytics();
      try {
        const client = new LabelsClient(new HttpClient(getConfig()));
        await client.remove(pageId, labelName);
        console.log(chalk.green(`Label "${labelName}" removed.`));
        analytics.track('label_remove', true);
      } catch (error) {
        analytics.track('label_remove', false);
        console.error(chalk.red('Error:'), (error as Error).message);
        process.exit(1);
      }
    });
}
```

- [ ] **Step 4: Create doctor command (new feature)**

Create `src/commands/doctor.ts`:

```typescript
import type { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig, resolveProfile, CONFIG_FILE } from '../config/loader';
import { getEnvOverrides } from '../config/loader';
import { HttpClient } from '../client/http';
import { getConfig } from '../config';
import { formatJson } from '../format/output';

interface DoctorCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Validate configuration, authentication, and connectivity')
    .option('--space <key>', 'Also validate space access')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const checks: DoctorCheck[] = [];

      // 1. Config file exists
      try {
        loadConfig();
        checks.push({ name: 'Config file', status: 'pass', message: `Found at ${CONFIG_FILE}` });
      } catch (error) {
        checks.push({ name: 'Config file', status: 'fail', message: (error as Error).message });
        printResults(checks, options.json);
        process.exit(1);
        return;
      }

      // 2. Active profile has required fields
      const appConfig = loadConfig();
      const envOverrides = getEnvOverrides();
      const profileName = envOverrides.profile || appConfig.activeProfile;
      const profile = appConfig.profiles[profileName];
      if (!profile) {
        checks.push({ name: 'Active profile', status: 'fail', message: `Profile "${profileName}" not found` });
      } else if (!profile.domain) {
        checks.push({ name: 'Active profile', status: 'fail', message: `Profile "${profileName}" missing domain` });
      } else {
        checks.push({ name: 'Active profile', status: 'pass', message: `Profile "${profileName}" OK (${profile.domain})` });
      }

      // 3. Authentication credentials present
      const auth = profile?.auth;
      if (!auth) {
        checks.push({ name: 'Authentication', status: 'fail', message: 'No auth configuration' });
      } else {
        const hasCreds =
          (auth.type === 'basic' && 'email' in auth && 'token' in auth) ||
          (auth.type === 'bearer' && 'token' in auth) ||
          (auth.type === 'cookie' && 'cookie' in auth) ||
          (auth.type === 'mtls' && 'tlsClientCert' in auth && 'tlsClientKey' in auth);
        if (hasCreds) {
          checks.push({ name: 'Authentication', status: 'pass', message: `${auth.type} credentials present` });
        } else {
          checks.push({ name: 'Authentication', status: 'fail', message: `${auth.type} credentials incomplete` });
        }
      }

      // 4. Network connectivity + 5. API token validity
      if (profile?.domain) {
        try {
          const config = getConfig();
          const http = new HttpClient(config);
          await http.get('/space', { limit: 1 });
          checks.push({ name: 'Connectivity', status: 'pass', message: `Connected to ${config.domain}` });
          checks.push({ name: 'API token', status: 'pass', message: 'Token is valid' });
        } catch (error) {
          const msg = (error as Error).message;
          if (msg.includes('401')) {
            checks.push({ name: 'API token', status: 'fail', message: 'Unauthorized — token invalid or missing scopes' });
          } else if (msg.includes('403')) {
            checks.push({ name: 'API token', status: 'fail', message: 'Forbidden — missing scopes or no product access' });
          } else {
            checks.push({ name: 'Connectivity', status: 'fail', message: `Cannot reach Confluence: ${msg}` });
          }
        }
      }

      // 6. Space access (optional)
      if (options.space) {
        try {
          const config = getConfig();
          const http = new HttpClient(config);
          await http.get(`/space/${options.space}`);
          checks.push({ name: 'Space access', status: 'pass', message: `Can access space "${options.space}"` });
        } catch (error) {
          checks.push({ name: 'Space access', status: 'fail', message: `Cannot access space "${options.space}": ${(error as Error).message}` });
        }
      }

      printResults(checks, options.json);
      const hasFailures = checks.some((c) => c.status === 'fail');
      process.exit(hasFailures ? 1 : 0);
    });
}

function printResults(checks: DoctorCheck[], json: boolean): void {
  if (json) {
    console.log(formatJson(checks));
    return;
  }
  for (const check of checks) {
    const icon = check.status === 'pass' ? chalk.green('PASS') : check.status === 'warn' ? chalk.yellow('WARN') : chalk.red('FAIL');
    console.log(`[${icon}] ${check.name}: ${check.message}`);
  }
}
```

- [ ] **Step 5: Create remaining command modules**

Create `src/commands/comments.ts`, `src/commands/attachments.ts`, `src/commands/properties.ts`, `src/commands/search.ts`, `src/commands/spaces.ts`, `src/commands/export.ts`, `src/commands/profile.ts`, `src/commands/convert.ts` — each follows the same pattern:
  - Import typed clients from `src/client/`
  - Export a `register*Commands(program: Command)` function
  - Port the command handlers from the corresponding sections of `bin/confluence.js`
  - All commands get `--json` option for structured output
  - Search commands get `--space` and `--type` filter options

Each file mirrors the structure shown in blog/labels/doctor above.

- [ ] **Step 6: Commit**

```bash
git add src/commands/
git commit -m "feat: add all command modules with --json support and new features"
```

---

### Task 14: CLI Wiring — Main Program

**Files:**
- Create: `src/cli.ts`
- Create: `src/index.ts`

- [ ] **Step 1: Create CLI program setup**

Create `src/cli.ts`:

```typescript
import { Command } from 'commander';
import { registerPageCommands } from './commands/pages';
import { registerBlogCommands } from './commands/blog';
import { registerLabelCommands } from './commands/labels';
import { registerCommentCommands } from './commands/comments';
import { registerAttachmentCommands } from './commands/attachments';
import { registerPropertyCommands } from './commands/properties';
import { registerSearchCommands } from './commands/search';
import { registerSpaceCommands } from './commands/spaces';
import { registerExportCommand } from './commands/export';
import { registerDoctorCommand } from './commands/doctor';
import { registerProfileCommands } from './commands/profile';
import { registerConvertCommand } from './commands/convert';
import { initConfig, listProfiles, setActiveProfile, deleteProfile } from './config';
import { Analytics } from './analytics';
import chalk from 'chalk';
import inquirer from 'inquirer';

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pkg = require('../package.json');

export function createProgram(): Command {
  const program = new Command();

  program
    .name('confluence')
    .description('CLI tool for Atlassian Confluence')
    .version(pkg.version)
    .option('--profile <name>', 'Use a specific configuration profile')
    .option('--json', 'Output as JSON');

  // Init command (kept inline since it's config-only)
  program
    .command('init')
    .description('Initialize Confluence CLI configuration')
    .option('-d, --domain <domain>', 'Confluence domain')
    .option('--protocol <protocol>', 'Protocol (http or https)')
    .option('-p, --api-path <path>', 'REST API path')
    .option('-a, --auth-type <type>', 'Authentication type (basic, bearer, mtls, cookie)')
    .option('-e, --email <email>', 'Email or username for basic auth')
    .option('-t, --token <token>', 'API token')
    .option('-c, --cookie <cookie>', 'Cookie for Enterprise SSO')
    .option('--tls-ca-cert <path>', 'CA certificate for mTLS')
    .option('--tls-client-cert <path>', 'Client certificate for mTLS')
    .option('--tls-client-key <path>', 'Client private key for mTLS')
    .option('--read-only', 'Set profile to read-only mode')
    .action(async (options) => {
      const profile = program.opts().profile;
      await initConfig({ ...options, profile });
    });

  // Stats command
  program
    .command('stats')
    .description('Show usage statistics')
    .action(() => {
      new Analytics().showStats();
    });

  // Register all command groups
  registerPageCommands(program);
  registerBlogCommands(program);
  registerLabelCommands(program);
  registerCommentCommands(program);
  registerAttachmentCommands(program);
  registerPropertyCommands(program);
  registerSearchCommands(program);
  registerSpaceCommands(program);
  registerExportCommand(program);
  registerDoctorCommand(program);
  registerProfileCommands(program);
  registerConvertCommand(program);

  return program;
}
```

Create `src/index.ts`:

```typescript
import { createProgram } from './cli';

const program = createProgram();

if (process.argv.length <= 2) {
  program.help({ error: false });
}

program.parse(process.argv);
```

- [ ] **Step 2: Build and test**

```bash
bun run build
node dist/bin/confluence.js --help
```

Expected: Help output showing all commands including new `blog`, `label`, `doctor`.

- [ ] **Step 3: Commit**

```bash
git add src/cli.ts src/index.ts
git commit -m "feat: wire CLI program with all commands registered"
```

---

### Task 15: Integration Testing and Cleanup

**Files:**
- Modify: `package.json` (remove old JS bin entries)
- Delete: `bin/` (old JS CLI)
- Delete: `lib/` (old JS library)

- [ ] **Step 1: Run full test suite**

```bash
bun test
```

Expected: All tests pass.

- [ ] **Step 2: Run linter and type checker**

```bash
bun run lint
bun run typecheck
```

Expected: Zero warnings, zero errors.

- [ ] **Step 3: Build production output**

```bash
bun run build
```

Expected: Clean build in `dist/`.

- [ ] **Step 4: Smoke test key commands**

```bash
node dist/bin/confluence.js --help
node dist/bin/confluence.js doctor
node dist/bin/confluence.js blog list SD
node dist/bin/confluence.js label list 425993
node dist/bin/confluence.js search "test" --space SD --json
```

Expected: All commands work.

- [ ] **Step 5: Remove old JS files**

```bash
trash-put bin/ lib/
```

Update `package.json` to remove old file references.

- [ ] **Step 6: Update README if needed**

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "chore: remove old JS source, finalize TS migration"
```
