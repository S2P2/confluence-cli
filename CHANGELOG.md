# Changelog

All notable changes to this project will be documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

For changes prior to this fork, see the [upstream changelog](https://github.com/pchuri/confluence-cli/blob/v1.33.0/CHANGELOG.md).

## [Unreleased]

### Fixed

- `create-child` now passes `parentId` and `spaceKey` in the correct order to `createChildPage()`, which previously caused `Cannot extract page ID from "SD"` error (#20).
- Attachment download now decodes HTML entities (`&amp;` → `&`) in download URLs before making the request, which previously caused 404 errors (#15).

## [0.1.8] - 2026-04-27

### Added

- `service-account` auth type for Atlassian service account tokens (ATSTT). `confluence init` now offers a `service-account` choice that auto-fetches the cloud ID from `/_edge/tenant_info` and configures the `api.atlassian.com` gateway with the correct API path.
- `siteUrl` profile field stores the original site domain for correct page link generation when using the API gateway.
- `CONFLUENCE_SITE_URL` environment variable for overriding the site URL.

### Fixed

- `normalizeProfileConfig` now preserves nested `auth` objects from config.json instead of discarding them. Previously, the loader always reconstructed auth from flat fields (`authType`, `token` at top level), losing the token when the config used the nested `auth: { type, token }` format written by `initConfig`.
- `pageUrl` in page commands now uses `siteUrl` (original domain) when available, producing correct page links for service-account profiles where `domain` is `api.atlassian.com`.

## [0.1.5] - 2026-04-26

### Fixed

- Plugin `plugin.json` and `marketplace.json` now reference the forked repo (`S2P2/confluence-cli`) instead of the original
- Installation instructions updated to `npm install -g @s2p2/confluence-cli`
- `confluence` binary now resolves `package.json` correctly by inlining it at build time (was broken by relative path from `dist/bin/`)
- Biome config fixed for v2.x (schema, rule names, import order)
- `@biomejs/biome` added as devDependency (was global install only)
- Type errors fixed: added missing `view` and `self` properties to API response types
- Lint fixes: replaced `as any` casts with proper types, removed unused variable destructuring

### Changed

- CI switched from npm to bun for install, lint, typecheck, test, and build
- CI actions pinned to SHA hashes with version comments
- Replaced semantic-release with trusted publishing (OIDC) — publish to npm on GitHub Release, no tokens needed
- Dropped homebrew tap publish job (targeted upstream repo)
- Removed dead `scripts/generate-prod-shrinkwrap.sh`

## [0.1.4] - 2026-04-26

### Added

- `find` command now shows space name and page URL in results
- `find` command accepts `--type` option to search for pages, blog posts, comments, or attachments

### Fixed

- URLs in `find`, `create`, `create-child`, `update`, `blog get`, and `children` now use the actual site URL instead of the API domain (fixes scoped API token setups)
- `markdownToStorage` no longer wraps block elements (headings, hr) in `<p>` tags, which produced empty `<p />` artifacts in Confluence
- `children --recursive --format tree` now correctly nests children under their parent (was flat list)
- `children --recursive --format tree` shows 📁/📄 icons matching the Rust CLI

## [0.1.3] - 2025-04-25

### Added

- `blog read <id>` command to read blog post body content with `--format` support (storage, html, text, markdown)

### Fixed

- `read --format markdown` now converts HTML to markdown instead of outputting raw HTML
- Comments list now expands `history` so author and date are populated
- Comments list uses correct `extensions` (plural) API field for location, resolution, and inline metadata
- Default comment location changed from "unknown" to "footer" when API doesn't return a location
- Removed non-existent `comment <pageId>` alias from README; examples updated to use `comment add <pageId>`
- `blog update` now includes current title in PUT payload (required by Confluence API)
- `blog update --format markdown` and `page create/update --format markdown` now convert markdown to storage HTML before sending; `representation` always set to `storage`
- Renamed `label remove` to `label delete` for consistency with other commands (`comment delete`, `attachment delete`, `property delete`)

## [0.1.2] - 2025-04-25

### Changed

- Removed legacy JavaScript source (`lib/`), CLI entry points (`bin/`), and 9 dead test files
- Removed legacy ESLint and Jest configs; project uses Biome + `bun test` exclusively
- Replaced all `any` types in client layer with typed raw API response interfaces (`RawPageResponse`, `RawCommentResponse`, etc.)
- Renamed `PagesClient` class to `DefaultPagesClient`, added `PagesClient` interface for consistency with other clients
- Extracted duplicated `assertWritable` and `handleCommandError` into shared `src/commands/helpers.ts`
- Split `src/commands/pages.ts` (1206 lines) into `pages/crud.ts`, `pages/tree.ts`, `pages/export.ts`, `pages/index.ts`
- Fixed tsup config: shebang (`#!/usr/bin/env node`) applied to CLI binary only, not the library output
- Updated minimum Node.js version from 14 to 18 (matches ES2022 target)

### Added

- Axios error interceptor with actionable messages for HTTP 401, 403, 404, 409, 429

### Fixed

- Labels test now uses `bun:test` instead of `vitest`
- Removed unused `writeStream` utility from `src/utils/fs.ts`

## [0.1.0] - 2025-04-25

### Changed

- Rewrote entire codebase from JavaScript to TypeScript with strict mode (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`)
- Build with tsup, dev workflow with `bun dev -- <command>`
- Lint with Biome instead of ESLint
- Commands reorganized as grouped subcommands (`space get`, `blog list`, `label add`) with flat aliases for backward compatibility
- Config loader supports both flat (original JS) and nested (TS) auth format

### Added

- **Blog posts**: `blog list`, `blog get`, `blog create`, `blog update`, `blog delete`
- **Labels**: `label list`, `label add`, `label remove`
- **Diagnostics**: `doctor` command to validate config, auth, and connectivity
- **Space details**: `space get <key>` command
- **Search filters**: `--space <key>`, `--type <page|blog>` on `search`
- **`--json` output** on most commands for machine-readable results
- **Grouped commands**: `page list/get/tree`, `comment list/add/delete`, `attachment list/upload/download/delete`, `property list/get/set/delete`

### Acknowledgments

Fork of [pchuri/confluence-cli](https://github.com/pchuri/confluence-cli). New features inspired by [rvben/confluence-cli](https://github.com/rvben/confluence-cli) (Rust).
