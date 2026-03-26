# Session Stand-Up: 2026-03-26

## Accomplished

### Project Metadata — TCL-53 (COMPLETE)
- `packages/sandpiper-tasks-cli/src/core/project-metadata.ts` — render, parse, read, write, update
- `ProjectMetadata`, `ProjectStatus`, `ProjectListItem` types in `types.ts`
- `project create` now requires `--name`, `--description`, `--when-to-file`
- New commands: `project show`, `project update` (with `-i` editor support)
- `project list` — enriched human output + structured toon/json with metadata
- `task show --metadata-only` — frontmatter-only output
- Backfilled `PROJECT.md` for all 9 existing projects
- `SPEC.md` §2.3 + `SKILL.md` session-start load instruction updated (source, not dist)
- 235 task CLI tests passing

### Web Fetch Tool — WEB-1 (COMPLETE)
- New extension at `extensions/web-fetch/` — `web_fetch` tool
- Pipeline: `fetch()` → `jsdom` → `@mozilla/readability` → `turndown` → markdown
- Framework-independent core: `types.ts`, `fetch.ts`, `extract.ts`, `convert.ts`, `pipeline.ts`
- `index.ts` — Pi tool registration with metadata envelope
- PRD at `.sandpiper/docs/web-fetch-prd.md`
- 25 tests (real HTTP servers, no mocks)
- Dependencies via bun `catalog:web` (exact versions): readability 0.6.0, jsdom 29.0.1, turndown 7.2.2
- **Extension loading fix:** `bunfig.toml` with `linker=hoisted` so deps land in root `node_modules/`; extension uses tsc output (`./dist/index.js`) not single-file bundle

### Shell Relay Backlog Tickets
- SHR-68: bash user command capture (DEBUG trap) — backlog
- SHR-69: zsh user command capture (zle widget) — backlog
- SHR-70: PTY spike (COMPLETE) — decided: write our own lean library
- SHR-71: PTY MVP (replace unbuffer-relay with @lydell/node-pty) — backlog
- AGENT-15: background process framework (moved from SHR-72) — backlog
- OpenClaw investigation at `.sandpiper/docs/openclaw-process-supervisor-investigation.md`

### jj Workflow Guidance
- `AGENTS.md`: `jj commit` preference over `describe + new`
- `skills/sandpiper/jj/SKILL.md`: tailored externally-authored skill — `jj commit` in edit workflow, `Making commits` section, failure mode explanation, Common Pitfalls entry
- Added `jj bookmark advance` to skill + `references/commands.md`
- All migration subtasks (AGENT-3/4/6/7/9/10) closed

### Commit Methodology
- Established commit-per-subtask methodology for code review
- `jj commit` preferred over `jj describe + jj new` — documented in AGENTS.md and skill
- `jj bookmark advance` — forward-only safe bookmark movement

## In Progress
- Nothing — all work committed and pushed to main

## Next Session
1. **TCL-56** (MEDIUM) — Atomicity improvements for task operations
2. **SHR-62** (MEDIUM) — Long write-chars injections may wrap and confuse fish parser
3. **SHR-63** (MEDIUM) — First command after setup often times out (prompt_ready race condition)
4. File a LOW ticket for the build system long-term fix (per-extension postinstall strategy)

## Blockers
- `pi.sendUserMessage()` doesn't route through slash command pipeline (upstream pi bug)
- Sandpiper not published to npm — blocks self-update notification

## Context
- **`bunfig.toml` linker=hoisted** — deps are hoisted to root `node_modules/`. This was added to make web-fetch's npm deps resolvable from `dist/`. All existing packages continue to work.
- **Extensions with npm deps use tsc output, not bun bundles** — `pi.extensions: ["./dist/index.js"]` with standard imports that resolve via hoisted node_modules. Extensions without npm deps (shell-relay) can still use single-file bun bundles.
- **Edit source skills, not dist** — always edit under `skills/sandpiper/`, then `bash devtools/postinstall.sh` to sync to `dist/`. Never edit `dist/` directly.
- **`project list --format toon` at session start** — tasks skill instructs agents to load all project `whenToFile` routing triggers.
- **`sandpiper-tasks` binary must be rebuilt** — after CLI changes: `bun run --filter sandpiper-tasks-cli build` AND `bash devtools/postinstall.sh`.
- **TCL-56 approach** — atomic writes first (write-to-temp-rename), index self-healing second, skip file locking.
- **Working tree is clean** — all changes committed and pushed to main.
