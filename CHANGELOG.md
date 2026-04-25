# Changelog

All notable changes to this project will be documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

For changes prior to this fork, see the [upstream changelog](https://github.com/pchuri/confluence-cli/blob/v1.33.0/CHANGELOG.md).

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
