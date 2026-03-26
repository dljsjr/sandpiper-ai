# Session Stand-Up: 2026-03-26

## Accomplished

### Project Metadata — TCL-53 (COMPLETE)
- `ProjectMetadata`, `ProjectListItem` types; `project-metadata.ts` core module
- `project create` enforces `--name`, `--description`, `--when-to-file`
- New commands: `project show`, `project update` (with `-i` editor support)
- `project list` — enriched human output + structured toon/json with metadata
- `task show --metadata-only` — frontmatter-only output
- Backfilled `PROJECT.md` for all 9 existing projects
- `SPEC.md` §2.3 + `SKILL.md` session-start instruction
- 235 task CLI tests passing

### Web Fetch Tool — WEB-1 (COMPLETE)
- New extension at `extensions/web-fetch/` — `web_fetch` tool
- Pipeline: `fetch()` → `jsdom` → `@mozilla/readability` → `turndown` → markdown
- 25 tests, dependencies via bun `catalog:web`
- PRD at `.sandpiper/docs/web-fetch-prd.md`
- **Build fix:** `bunfig.toml` with `linker=hoisted`; extension uses tsc output (`./dist/index.js`)

### Task Atomicity — TCL-56 (COMPLETE)
- `writeFileAtomic()` — write-to-temp-then-rename for all 17 production call sites
- Index self-healing — `isIndexConsistent()` auto-rebuilds on count mismatch
- 229 task CLI tests passing

### Shell Relay Backlog
- SHR-68 (bash DEBUG trap), SHR-69 (zsh zle widget), SHR-71 (PTY MVP) — filed
- SHR-70 (PTY spike) COMPLETE — decision: write own lean library
- AGENT-15 (background process framework) — filed, moved from SHR-72
- OpenClaw investigation at `.sandpiper/docs/openclaw-process-supervisor-investigation.md`

### jj Skill + Workflow
- `jj commit` preference added to AGENTS.md and jj skill (with failure mode explanation)
- `jj bookmark advance` added to skill + commands reference
- Tailored externally-authored jj skill for our workflow preferences

### Self-Reflection Improvements
- Restructured `/self-reflect` prompt template into 4 explicit phases
- Skills audit is now Phase 1 with per-skill checklist and explicit "no new skills" requirement
- Caught and fixed stale tasks SKILL.md + SPEC.md during self-reflection pass

### Branding Backlog
- AGENT-16 (TUI rebranding), TCL-69 (tasks CLI rename), SHR-73 (shell relay rename) — filed

### Housekeeping
- All migration subtasks (AGENT-3/4/6/7/9/10) closed
- TOOLS-10 filed: per-extension postinstall strategy for npm deps

## In Progress
- Nothing — all work committed and pushed

## Next Session
1. **SHR-62** (MEDIUM) — Long write-chars injections may wrap and confuse fish parser
2. **SHR-63** (MEDIUM) — First command after setup often times out (prompt_ready race condition)
3. **MEM-1** or **PKM-1** (MEDIUM) — Memory/PKM design work

## Blockers
- `pi.sendUserMessage()` doesn't route through slash command pipeline (upstream pi bug)
- Sandpiper not published to npm — blocks self-update notification

## Context
- **`bunfig.toml` linker=hoisted** — deps hoisted to root `node_modules/`. Required for web-fetch extension.
- **Extensions with npm deps use tsc output** — `pi.extensions: ["./dist/index.js"]`, not bun bundles. Standard imports resolve via hoisted node_modules.
- **Edit source skills, not dist** — edit `skills/sandpiper/`, run `bash devtools/postinstall.sh`.
- **Squash caution** — TCL-53 features were lost twice during squash operations. Always verify key features survive after squashing multi-commit stacks.
- **`project list --format toon` at session start** — loads `whenToFile` routing triggers.
- **`sandpiper-tasks` binary** — after CLI changes: `bun run --filter sandpiper-tasks-cli build` AND `bash devtools/postinstall.sh`.
- **Self-reflect prompt** — restructured into 4 phases; skills audit is Phase 1 and must not be skipped.
- **Working tree is clean** — all changes committed and pushed to main.
