# AGENTS.md

## Project Overview

Fork of `pchuri/confluence-cli` (TypeScript CLI for Atlassian Confluence Cloud). Published to npm as `@s2p2/confluence-cli`.

## Tech Stack

- **Runtime:** Bun (dev), Node 22+ (production)
- **Build:** tsup
- **Lint/Format:** Biome (`bun run lint`, `bun run lint:fix`)
- **Typecheck:** `bun run typecheck` (tsc --noEmit, strict mode)
- **Test:** `bun test`
- **Package manager:** Bun (`bun install`, `bun.lock`)

## Before Committing

Run all checks and fix any failures:

```sh
bun run lint        # Biome check
bun run typecheck   # tsc --noEmit
bun test            # bun test
bun run build       # tsup build
```

## Publishing

Publishing is automated via GitHub Actions with OIDC (trusted publishing, no tokens).

1. Bump version: `npm version patch -m "chore: release v%s"` (or `minor`/`major`)
2. Push: `git push --follow-tags`
3. Create a **GitHub Release** from the tag on the repo
4. CI publishes to npm automatically

Do **not** run `npm publish` manually.

## Commit Style

- Conventional commits: `fix:`, `feat:`, `chore:`, `docs:`, `refactor:`, `test:`
- Imperative mood, ≤72 char subject line
- One logical change per commit

## Code Style

- Single quotes, no semicolons, 2-space indent, 120 char line width (enforced by Biome)
- Strict TypeScript: `noUncheckedIndexedAccess`, `verbatimModuleSyntax`
- No `any` — use proper types
- No `console.log` in library code; `chalk` for CLI output
- Newtypes and enums over primitives and booleans
- `thiserror` pattern for errors (typed error classes)
