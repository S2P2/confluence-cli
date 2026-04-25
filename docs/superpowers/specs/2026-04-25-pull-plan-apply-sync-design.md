# Pull / Plan / Apply Sync Workflow

**Date:** 2026-04-25
**Status:** Approved
**Scope:** Port pull/plan/apply sync from rvben/confluence-cli (Rust v0.1.10) to the TypeScript CLI

## Overview

Sync Confluence content to local markdown files and back. Pull downloads pages as markdown + sidecar metadata. Plan compares local state against sidecars to detect changes. Apply pushes changes back to Confluence.

The feature is designed for agent-driven workflows: pull a space, let an agent edit markdown files, then plan/apply to sync changes back.

## Commands

```
confluence pull page <ID> <OUTPUT_DIR>
confluence pull tree <ID> <OUTPUT_DIR>
confluence pull space <SPACE> <OUTPUT_DIR>
confluence plan <PATH>
confluence apply <PATH>
```

## Output Structure

Each page becomes a directory:

```
<OUTPUT_DIR>/
├── Getting Started--12345/
│   ├── index.md              # Frontmatter + markdown body
│   ├── .confluence.json      # Sidecar (sync metadata)
│   └── attachments/
│       ├── screenshot.png
│       └── doc.pdf
├── API Reference--67890/
│   ├── index.md
│   ├── .confluence.json
│   └── attachments/
└── ...
```

Directory name format: `{title}--{contentId}` (slugged title, numeric ID).

## Frontmatter (index.md)

User-editable metadata in YAML frontmatter:

```yaml
---
title: Getting Started
kind: page
labels:
  - onboarding
  - docs
status: current
parent: "67890"              # parent page ID (empty string if root)
properties:
  status: draft
  review-date: "2026-05-01"
---

# Getting Started

Markdown body here...
```

**Fields:**
- `title` (string) — page title
- `kind` (string) — `page` or `blogpost`
- `labels` (string[]) — page labels
- `status` (string) — `current` or `draft`
- `parent` (string) — parent page ID, empty string for root-level pages
- `properties` (object) — content properties (string values only)

The body after frontmatter is the page content in markdown.

## Sidecar (.confluence.json)

Internal sync metadata. Users should not edit this file.

```typescript
interface Sidecar {
  contentId: string
  version: number
  bodyHash: string           // SHA256 of the markdown body (after frontmatter)
  storageHash: string        // SHA256 of the original Confluence storage format
  baseUrl: string            // Confluence base URL at time of pull
  spaceKey: string
  kind: 'page' | 'blogpost'
  status: string
  parentId: string
  attachments: Record<string, {
    filename: string
    attachmentId: string
    hash: string              // SHA256 of the file contents
    mediaType: string
    fileSize: number
  }>
  pulledAt: string            // ISO timestamp
}
```

The sidecar enables:
- **Change detection:** Compare `bodyHash` against current markdown to detect edits
- **Version tracking:** Use `version` for optimistic concurrency on update
- **Attachment tracking:** Detect new/removed/modified attachments by hash
- **Conflict detection:** Re-pull compares `storageHash` to detect remote changes

## Storage Conversion

Full bidirectional converter between Confluence storage format (XML) and markdown, ported from Rust's `markdown.rs` (5,361 lines).

### Module: `src/format/storage.ts`

**Core functions:**
- `storageToMarkdown(storage: string): string` — Confluence storage XML → readable markdown
- `markdownToStorage(md: string, allowLossy?: boolean): ConversionOutput` — markdown → storage XML

**ConversionOutput:**
```typescript
interface ConversionOutput {
  storage: string
  lossy: boolean             // true if information was lost during conversion
  warnings: string[]         // descriptions of what was lost or approximated
}
```

**Elements handled:**

| Confluence Element | Markdown Representation |
|---|---|
| Code block (`ac:structured-macro name="code"`) | Fenced code block with language tag |
| Info/note/tip/warning panels | `> [!NOTE]` blockquotes |
| Expand/collapse sections | `<details><summary>` HTML |
| Status macro | `[status: text / color]` placeholder |
| Include page | `[include: Page Title]` placeholder |
| Excerpt | `[excerpt]...[/excerpt]` markers |
| Page links (`ac:link`) | `[Page Title](page:ID)` or `[Page Title](page:slug)` |
| User mentions (`ri:user`) | `@Username` |
| Task lists | `- [ ]` / `- [x]` |
| Tables | Markdown tables |
| Images | `![](attachment:filename)` |
| Attachments | `[filename](attachment:filename)` |
| Unknown macros | Raw XML placeholder `<!-- confluence-macro: ... -->` |

**Placeholder system:** Elements that cannot be cleanly converted are preserved as raw XML in HTML comments. These pass through the round trip unchanged, preventing data loss.

**Lossy detection:** When `markdownToStorage` encounters markdown that cannot fully represent the original storage format, it sets `lossy: true` and adds descriptions to `warnings`. Apply warns the user unless `--allow-lossy` is set.

## Pull Flow

```
confluence pull page <ID> ./output
confluence pull tree <ID> ./output
confluence pull space <SPACE> ./output
```

### Steps

1. **Resolve scope:**
   - `page` — fetch single page by ID
   - `tree` — fetch page + all descendants (recursive)
   - `space` — fetch all pages in space (paginated), then build tree

2. **For each page:**
   a. Fetch page content from API (`GET /rest/api/content/{id}?expand=body.storage,version,metadata.labels,space,ancestors,extensions.properties`)
   b. Convert storage → markdown via `storageToMarkdown`
   c. Extract metadata into frontmatter (title, kind, labels, status, parent, properties)
   d. Build sidecar (contentId, version, bodyHash, storageHash, baseUrl, spaceKey, etc.)
   e. Fetch attachments list
   f. Download attachment files
   g. Write `index.md`, `.confluence.json`, and attachment files

3. **Link rewriting:** After all pages are downloaded, rewrite local links to use relative paths where possible. If a linked page wasn't pulled, keep the placeholder format.

### Options

- `--format markdown` (default) — convert storage to markdown
- `--format storage` — save raw storage XML (no conversion)
- `--no-attachments` — skip attachment download
- `--limit N` — limit pages (for space pull)

## Plan Flow

```
confluence plan <PATH>
```

Purely local — no API calls. Compares current files against sidecars.

### Steps

1. **Scan** — walk directory for `*/index.md` entries
2. **Load** — parse frontmatter + body from each `index.md`, load `.confluence.json`
3. **Compare** — hash markdown body, compare against sidecar's `bodyHash`
4. **Classify** each content item:

| Condition | Action |
|---|---|
| No sidecar exists | `CreateContent` |
| Sidecar + body hash mismatch | `UpdateContent` |
| Frontmatter `parent` changed | `MoveContent` |
| Frontmatter `labels` changed | `UpdateLabels` |
| Frontmatter `properties` changed | `UpdateProperties` |
| New file in `attachments/` | `UploadAttachment` |
| Attachment missing from disk | `DeleteAttachment` |
| Page directory removed entirely | `DeleteRemote` (only with `--delete-remote`) |
| No changes detected | `Noop` |

5. **Output** — table of planned actions

### Output

```
ACTION         TARGET                          DETAILS
CreateContent  new-page--                      "New Page" in space DEV
UpdateContent  getting-started--12345          body changed
MoveContent    api-reference--67890            parent: 11111 → 22222
UpdateLabels   faq--55555                      +onboarding, -legacy
UploadAttach   getting-started--12345          new-diagram.png
Noop           about--44444                    no changes

7 items: 1 create, 1 update, 1 move, 1 labels, 1 upload, 1 delete, 1 noop
```

### Options

- `--delete-remote` — include `DeleteRemote` actions for removed directories
- `--json` — output plan as JSON

## Apply Flow

```
confluence apply <PATH>
```

### Steps

1. **Plan** — run the same scan as `plan`
2. **Confirm** — show actions, prompt for confirmation (skip with `--force`)
3. **Execute** — for each action, call the Confluence API:
   - `CreateContent`: `POST /rest/api/content`
   - `UpdateContent`: `PUT /rest/api/content/{id}` with current version incremented
   - `MoveContent`: `PUT /rest/api/content/{id}` with new ancestor
   - `UpdateLabels`: `POST/DELETE /rest/api/content/{id}/label`
   - `UpdateProperties`: `POST/DELETE /rest/api/content/{id}/property`
   - `UploadAttachment`: `POST /rest/api/content/{id}/child/attachment`
   - `DeleteAttachment`: `DELETE /rest/api/attachment/{id}`
   - `DeleteRemote`: `DELETE /rest/api/content/{id}`
4. **Update sidecars** — after each successful operation, update `.confluence.json` with new version, hashes, etc.
5. **Create directories** — for new pages, create the `{title}--{id}` directory and sidecar

### Options

- `--force` — skip confirmation prompt
- `--allow-lossy` — don't warn on lossy conversions
- `--delete-remote` — enable remote deletions (must match plan)
- `--dry-run` — show what would happen without executing

## Error Handling

**Version conflicts:** Each sidecar stores the `version` number from when the page was pulled. On apply, the API call includes this version. If the remote page was updated since pull, the API returns a conflict. Apply stops and reports:
- Which page conflicted
- Local version vs remote version
- Instruction to pull again and resolve

**Partial failures:** If one action fails, stop immediately. Sidecars reflect only successfully completed operations. The user can fix the issue and re-run apply — it picks up where it left off.

**Lossy conversion:** If `markdownToStorage` reports lossy conversion, apply warns and lists what would be lost. User must confirm or use `--allow-lossy`.

## File Layout

New files in the TypeScript project:

```
src/
├── client/
│   └── sync.ts              # API calls for pull/apply (page tree traversal, batch operations)
├── commands/
│   └── sync.ts              # CLI commands: pull (page/tree/space), plan, apply
├── format/
│   ├── storage.ts           # Bidirectional storage↔markdown converter
│   └── frontmatter.ts       # YAML frontmatter parse/stringify
└── sync/
    ├── types.ts             # Sidecar, LocalDocument, PlanAction, SyncPlan types
    ├── scanner.ts           # Scan local directories, load documents
    ├── planner.ts           # Compare local vs sidecar, generate plan
    └── applier.ts           # Execute plan against Confluence API
```

## Dependencies

- `gray-matter` — YAML frontmatter parsing (or hand-rolled, it's simple)
- No new XML parser needed — use a lightweight HTML/XML parser (e.g. `node-html-parser` or regex for simple fragments). The Rust code uses `tl` (a lightweight parser); we'll use an equivalent TS approach.

## Out of Scope

- **Merge resolution** — no three-way merge. If remote changed, user must pull and re-apply.
- **Blog post sync** — pull/plan/apply handles pages only. Blog support can be added later.
- **Incremental pull** — `--since` flag for pulling only changed pages (deferred)
- **Parallel downloads** — sequential for v1, can optimize later
