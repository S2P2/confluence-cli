# Confluence CLI: TypeScript Rewrite + Feature Additions

**Date:** 2026-04-25
**Status:** Approved
**Scope:** TS rewrite of pchuri/confluence-cli (JS v1.33.0) + features from rvben/confluence-cli (Rust v0.1.10)

## Background

pchuri/confluence-cli (JS) is feature-rich for day-to-day work but lacks blog support, labels,
pull/plan/apply sync, doctor diagnostics, search filters, and shell completions. It's written in
plain JS with no types. rvben/confluence-cli (Rust) has those features but is less rich in output
formats, copy-tree, export, and AI agent integration.

Goal: Refactor the JS CLI to TypeScript and port the missing Rust features (except pull/plan/apply
sync, deferred to a later phase).

## Tooling

| Purpose   | Tool       | Notes                                |
|-----------|------------|--------------------------------------|
| Runtime   | Bun        | Node.js >=18 compatible              |
| Build     | tsup       | Compiles TS to JS, generates .d.ts   |
| Lint      | Biome      | Single biome.json, strict config     |
| Types     | tsc        | `--noEmit` for type checking         |
| Test      | bun test   | Co-located test files                |
| CLI       | Commander.js | Keep existing, add @types/commander |
| Packages  | Bun        | bun.lock, bun install                |

## Project Structure

```
confluence-cli/
├── src/
│   ├── index.ts              # Entry point
│   ├── cli.ts                # Commander program setup, global options
│   ├── config/
│   │   ├── types.ts          # Config/profile type definitions
│   │   ├── loader.ts         # Config loading, env var resolution
│   │   └── profiles.ts       # Profile CRUD operations
│   ├── client/
│   │   ├── types.ts          # API response types
│   │   ├── http.ts           # Axios wrapper, auth, retry logic
│   │   ├── pages.ts          # Page operations (CRUD, tree, export)
│   │   ├── blog.ts           # Blog post operations (new)
│   │   ├── comments.ts       # Comment operations
│   │   ├── attachments.ts    # Attachment operations
│   │   ├── labels.ts         # Label operations (new)
│   │   ├── properties.ts     # Content property operations
│   │   ├── search.ts         # Search with filters
│   │   └── spaces.ts         # Space operations
│   ├── commands/
│   │   ├── pages.ts          # Page CLI commands
│   │   ├── blog.ts           # Blog CLI commands (new)
│   │   ├── comments.ts       # Comment CLI commands
│   │   ├── attachments.ts    # Attachment CLI commands
│   │   ├── labels.ts         # Label CLI commands (new)
│   │   ├── properties.ts     # Property CLI commands
│   │   ├── search.ts         # Search CLI commands
│   │   ├── spaces.ts         # Space CLI commands
│   │   ├── export.ts         # Export CLI commands
│   │   ├── doctor.ts         # Doctor CLI command (new)
│   │   └── profile.ts        # Profile CLI commands
│   ├── format/
│   │   ├── markdown.ts       # Markdown to/from storage conversion
│   │   ├── output.ts         # Table/JSON/text output formatting
│   │   └── macro.ts          # Macro conversion
│   └── utils/
│       ├── fs.ts             # File system helpers
│       ├── url.ts            # URL building/resolution
│       └── sanitize.ts       # Filename/title sanitization
├── bin/
│   └── confluence.ts         # CLI entry script
├── tests/
├── biome.json
├── tsconfig.json
├── tsup.config.ts
├── package.json
└── bun.lock
```

## Config Types

```typescript
interface AuthConfig {
  type: 'basic' | 'bearer' | 'mtls' | 'cookie';
  email?: string;
  token?: string;
  cookie?: string;
  tlsCaCert?: string;
  tlsClientCert?: string;
  tlsClientKey?: string;
}

interface ProfileConfig {
  domain: string;
  protocol?: 'http' | 'https';
  apiPath?: string;
  auth: AuthConfig;
  readOnly?: boolean;
  forceCloud?: boolean;
  linkStyle?: string;
}

interface AppConfig {
  activeProfile: string;
  profiles: Record<string, ProfileConfig>;
}
```

Backward compatible with existing `~/.confluence-cli/config.json`. Environment variable
resolution (10+ vars) preserved as-is.

## New Features

### Blog Posts

Commands: `blog list <space>`, `blog get <id>`, `blog create <title> <space>`,
`blog update <id>`, `blog delete <id>`

Options mirror page commands: `--body`, `--content`, `--file`, `--format storage|markdown|html`

API: Confluence v1 `/rest/api/content` with `type=blogpost`

### Labels

Commands: `label list <pageId>`, `label add <pageId> <label>`, `label remove <pageId> <label>`

API: `/rest/api/content/{id}/label`

### Doctor

`confluence doctor [--space <key>]`

Validates:
1. Config file exists and is valid JSON
2. Active profile has required fields (domain, auth type, credentials)
3. Network connectivity to Confluence instance
4. API token is valid (lightweight API call)
5. Space access (when `--space` provided)

Output: Pass/fail for each check with actionable error messages.

### Search Filters

- `search <query> --space <key>` — Filter results to a space
- `search <query> --type page|blog` — Filter by content type
- Global `--json` flag on all commands for structured JSON output

### Space Details

- `space get <key>` — Get space details with `--json` support

## Build Configuration

**package.json:**
- `"type": "module"`
- `"main": "dist/index.js"`, `"types": "dist/index.d.ts"`
- `"bin": { "confluence": "dist/bin/confluence.js" }`
- Scripts: `build`, `dev`, `lint`, `typecheck`, `test`, `prepublishOnly`

**tsconfig.json:** Strict mode, ESM output, declaration files.

**tsup.config.ts:** Entry points for bin and lib, CJS + ESM dual output for Node compat.

## Migration Order

1. **Scaffolding** — tsconfig, biome.json, tsup.config.ts, package.json updates
2. **Config types** — `src/config/types.ts`, `loader.ts`, `profiles.ts`
3. **HTTP client** — `src/client/http.ts` (axios wrapper with auth)
4. **API client modules** — Port existing operations one domain at a time:
   pages, comments, attachments, properties, search, spaces
5. **Command modules** — Split `bin/confluence.js` (2096 lines) into focused command files
6. **Format conversion** — Port markdown/macro conversion to TS
7. **New features** — blog, labels, doctor, search filters, space get
8. **Output formatting** — `--json` support on all commands
9. **Tests** — Port existing Jest tests to bun test, add tests for new features
10. **Cleanup** — Remove old JS files, update README, verify CI

Each step leaves the CLI in a working state. Old JS files are only removed after their TS
replacements are verified.

## Deferred

- **Pull/plan/apply sync workflow** — largest missing feature (~1500 lines in Rust), deferred to
  a follow-up phase
- **Shell completions** — requires Commander.js plugin or custom implementation, can be added
  after core features are stable
- **Bug fixes** (attachment downloads with scoped tokens, URL-based page references) — test first
  in the TS rewrite, fix if still broken
