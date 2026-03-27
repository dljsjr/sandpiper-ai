# Session Stand-Up

Updated: 2026-03-27T17:00:00Z
Session: 0e5cb1a4-4133-404a-9c36-6e94354d38c4
Session file: /Users/doug.stephen/.sandpiper/agent/sessions/--Users-doug.stephen-git-sandpiper-ai--/2026-03-27T14-50-08-059Z_0e5cb1a4-4133-404a-9c36-6e94354d38c4.jsonl

## Accomplished

### Banner Styling — AGENT-17 (COMPLETE)
- Switched update notification and diagnostics banners to `ctx.ui.setWidget` with `DynamicBorder` framing, bold warning headings, muted body text, accent-colored commands/URLs
- Added `@mariozechner/pi-tui` to peerDependencies, pi catalog, and tsconfig paths

### Standup Skill Overhaul — AGENT-17 (COMPLETE)
- Codified "session" = agent context window, decoupled from calendar days/task boundaries
- Session UUID as primary key for same-session detection
- `SANDPIPER_SESSION_ID` and `SANDPIPER_SESSION_FILE` env vars injected at `session_start`
- Mid-session updates explicitly encouraged; "before context-heavy ops" checkpoint guidance

### Project Metadata Rename — TCL-70 (COMPLETE)
- Renamed `when_to_file` → `when_to_read` across all surfaces: types, CLI, tests, 9 PROJECT.md files, SKILL.md, SPEC.md
- Restored 9 PROJECT.md files lost in earlier squash (via `jj restore --from yrw`)
- 229 tests passing

### System Prompt Project Injection — AGENT-18 (COMPLETE)
- `collectProjectTriggers()` scans `.sandpiper/tasks/{project}/PROJECT.md` at agent start
- `formatProjectTriggersForPrompt()` formats as `<available_projects>` XML block injected into system prompt, mirroring pi's `<available_skills>` pattern
- ~750-860 tokens for 9 projects (~85-95 tokens/project)
- Agent now has project routing context without needing `project list --format toon` at session start

## In Progress
- Nothing — all work committed. User has the next task in mind (interrupt work).

## Next Session
1. **SHR-62** (MEDIUM) — Long write-chars injections may wrap and confuse fish parser
2. **SHR-63** (MEDIUM) — First command after setup often times out (prompt_ready race condition)
3. **MEM-1** or **PKM-1** (MEDIUM) — Memory/PKM design work
4. **AGENT-16** (LOW) — TUI rebranding — custom assets and theming

## Blockers
- `pi.sendUserMessage()` doesn't route through slash command pipeline (upstream pi bug)
- Sandpiper not published to npm — blocks self-update notification

## Context
- **`bunfig.toml` linker=hoisted** — deps hoisted to root `node_modules/`. Required for web-fetch extension.
- **Extensions with npm deps use tsc output** — `pi.extensions: ["./dist/index.js"]`, not bun bundles.
- **Edit source skills, not dist** — edit `skills/sandpiper/`, run `bash devtools/postinstall.sh`.
- **`sandpiper-tasks` binary** — after CLI changes: `bun run --filter sandpiper-tasks-cli build` AND `bash devtools/postinstall.sh`.
- **Widget MAX_WIDGET_LINES limit** — applies only to string arrays, NOT factory functions.
- **Session identity** — `SANDPIPER_SESSION_ID` and `SANDPIPER_SESSION_FILE` injected at `session_start`.
- **Project triggers in system prompt** — no longer need `project list --format toon` at session start. The `<available_projects>` block is injected automatically by `system.ts`.
- **Inactive projects (VND, SRL)** — still injected into prompt; could save ~170 tokens by filtering them out, but marginal.
