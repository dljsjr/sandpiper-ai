# Session Stand-Up

Updated: 2026-03-27T16:30:00Z
Session: 0e5cb1a4-4133-404a-9c36-6e94354d38c4
Session file: /Users/doug.stephen/.sandpiper/agent/sessions/--Users-doug.stephen-git-sandpiper-ai--/2026-03-27T14-50-08-059Z_0e5cb1a4-4133-404a-9c36-6e94354d38c4.jsonl

## Accomplished

### Banner Styling — AGENT-17 (COMPLETE)
- Verified the new pi 0.63.1 version update check is working end-to-end
- Switched update notification from `ctx.ui.notify` (flat yellow text) to `ctx.ui.setWidget` with DynamicBorder top/bottom, bold warning heading, muted body text, accent-colored install command and changelog URL
- Switched diagnostics banner from string array to factory function with same border treatment
- Added `@mariozechner/pi-tui` to `peerDependencies`, `pi` catalog, and `tsconfig.json` paths

### Standup Skill Overhaul — AGENT-17
- Codified "session" = agent context window, decoupled from calendar days and task boundaries
- Added session UUID as primary key for same-session detection (via `SANDPIPER_SESSION_ID` env var)
- Added `SANDPIPER_SESSION_FILE` env var for session file path reference
- Both injected in `session_start` via `ctx.sessionManager.getSessionId()` / `getSessionFile()`
- Mid-session updates explicitly encouraged; "before context-heavy ops" checkpoint guidance added

## In Progress
- Nothing — all work committed

## Next Session
1. **SHR-62** (MEDIUM) — Long write-chars injections may wrap and confuse fish parser
2. **SHR-63** (MEDIUM) — First command after setup often times out (prompt_ready race condition)
3. **MEM-1** or **PKM-1** (MEDIUM) — Memory/PKM design work
4. **AGENT-16** (LOW) — TUI rebranding — custom assets and theming for the sandpiper identity

## Blockers
- `pi.sendUserMessage()` doesn't route through slash command pipeline (upstream pi bug)
- Sandpiper not published to npm — blocks self-update notification (TODO commented in system.ts)

## Context
- **`bunfig.toml` linker=hoisted** — deps hoisted to root `node_modules/`. Required for web-fetch extension.
- **Extensions with npm deps use tsc output** — `pi.extensions: ["./dist/index.js"]`, not bun bundles.
- **Edit source skills, not dist** — edit `skills/sandpiper/`, run `bash devtools/postinstall.sh`.
- **`project list --format toon` at session start** — loads `whenToRead` routing triggers.
- **`sandpiper-tasks` binary** — after CLI changes: `bun run --filter sandpiper-tasks-cli build` AND `bash devtools/postinstall.sh`.
- **Widget MAX_WIDGET_LINES limit** — applies only to string arrays, NOT factory functions.
- **Session identity** — `SANDPIPER_SESSION_ID` and `SANDPIPER_SESSION_FILE` injected at `session_start` by system.ts.
