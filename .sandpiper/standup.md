# Session Stand-Up: 2026-03-26

## Accomplished

### Project Metadata — TCL-53 (COMPLETE)
- `packages/sandpiper-tasks-cli/src/core/project-metadata.ts` — render, parse, read, write, update
- `ProjectMetadata`, `ProjectStatus`, `ProjectListItem` types added to `types.ts`
- `PROJECT_METADATA_FILENAME` constant in `patterns.ts`
- `project create` now requires `--name`, `--description`, `--when-to-file` (enforced)
- New commands: `project show`, `project update` (with `-i` editor support)
- `project list` — enriched human output + structured toon/json with metadata + `whenToFile`
- `task show --metadata-only` — frontmatter-only output, no body or subtasks
- `extractFrontmatter()`, `formatProjectsOutput()` in `output.ts`
- Backfilled `PROJECT.md` for all 9 existing projects (AGENT, MEM, PKM, SHR, SRL, TCL, TOOLS, VND, WEB)
- `SPEC.md` §2.3: full `PROJECT.md` specification
- `SKILL.md`: session-start `project list --format toon` instruction + new command docs
- 235 tests passing, lint clean
- Squashed into single commit, pushed to main

### Housekeeping
- SHR-68, SHR-69 (bash/zsh command capture), SHR-70 (PTY spike, completed), SHR-71 (PTY MVP), SHR-72 (moved to AGENT-15 — background process framework)
- OpenClaw process/supervisor investigation at `.sandpiper/docs/openclaw-process-supervisor-investigation.md`
- All migration subtasks (AGENT-3/4/6/7/9/10) closed as DONE

### jj Workflow Guidance
- `AGENTS.md`: added `jj commit` preference over `describe + new` with heuristic
- `skills/sandpiper/jj/SKILL.md`: tailored externally-authored skill — added `jj commit` to edit workflow, `Making commits` section, failure mode explanation, Common Pitfalls entry
- `skills/sandpiper/jj/SKILL.md` + `references/commands.md`: added `jj bookmark advance` (new command, not previously documented)
- Session continuity confirmed working — used it at session start today

### Commit Methodology Lesson
- `jj commit` preferred over `jj describe + jj new` — added to AGENTS.md and jj skill
- `jj bookmark advance` — forward-only safe bookmark movement, useful after squashing

## In Progress
- Nothing — all work committed and pushed to main

## Next Session
1. **TCL-56** (MEDIUM) — Atomicity improvements for task operations (atomic writes first, index self-healing second)
2. **WEB-1** (MEDIUM) — Headless web browsing tool evaluation (lightpanda, Puppeteer, simple fetch)
3. **SHR-62** (MEDIUM) — Long write-chars injections may wrap and confuse fish parser
4. **SHR-63** (MEDIUM) — First command after setup often times out (prompt_ready race condition)

## Blockers
- `pi.sendUserMessage()` doesn't route through slash command pipeline (upstream pi bug)
- `bun install` requires two passes for bin linking on clean install (bun issue #19782)
- Sandpiper not published to npm — blocks self-update notification

## Context
- **`project list --format toon` at session start** — the tasks skill now instructs agents to run this to load all `whenToFile` routing triggers. This session was the first to use the new session continuity flow end-to-end — it worked well.
- **Skills edit source, not dist** — always edit under `skills/sandpiper/` (or `skills/third-party/`), then run `bash devtools/postinstall.sh` to sync to `dist/`. Never edit `dist/` directly.
- **`sandpiper-tasks` binary must be rebuilt** — after CLI changes, run `bun run --filter sandpiper-tasks-cli build` AND `bash devtools/postinstall.sh` to get the installed binary updated.
- **TCL-56 approach** — recommendations in previous standup still apply: atomic writes first (write-to-temp-rename), index self-healing second, skip file locking.
- **AGENT-15** — background process framework (moved from SHR-72). Not a priority. Approach documented in `.sandpiper/docs/openclaw-process-supervisor-investigation.md`.
- **jj bookmark advance** — newly discovered command, added to skill. Use instead of `bookmark set` when advancing main forward after squashing.
- **Working tree is clean** — all changes committed and pushed to main
