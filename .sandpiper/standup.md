# Session Stand-Up

Updated: 2026-03-27T18:00:00Z
Session: 0e5cb1a4-4133-404a-9c36-6e94354d38c4
Session file: /Users/doug.stephen/.sandpiper/agent/sessions/--Users-doug.stephen-git-sandpiper-ai--/2026-03-27T14-50-08-059Z_0e5cb1a4-4133-404a-9c36-6e94354d38c4.jsonl

## Accomplished

### Banner Styling — AGENT-17 (COMPLETE)
- Switched diagnostics banner to `ctx.ui.setWidget` with `DynamicBorder` framing (sticky above editor — correct for persistent diagnostics)
- Switched update notification to `pi.registerMessageRenderer` + `pi.sendMessage` — full component control with `DynamicBorder` + styled text, flows in chat like Pi's own banner
- Fire-and-forget pattern (`checkForUpdates().then(...)` instead of `await`) ensures the notification appears after startup info, matching Pi's placement
- Added `@mariozechner/pi-tui` to peerDependencies, pi catalog, and tsconfig paths

### Standup Skill Overhaul — AGENT-17 (COMPLETE)
- Codified "session" = agent context window, decoupled from calendar days/task boundaries
- Session UUID as primary key for same-session detection
- `SANDPIPER_SESSION_ID` and `SANDPIPER_SESSION_FILE` env vars injected at `session_start`

### Project Metadata Rename — TCL-70 (COMPLETE)
- Renamed `when_to_file` → `when_to_read` across all surfaces (types, CLI, tests, 9 PROJECT.md files, SKILL.md, SPEC.md)
- Restored 9 PROJECT.md files lost in earlier squash (via `jj restore --from yrw`)

### System Prompt Project Injection — AGENT-18 (COMPLETE)
- `collectProjectTriggers()` scans `.sandpiper/tasks/{project}/PROJECT.md` at agent start
- Formats as `<available_projects>` XML block injected into system prompt (~850 tokens for 9 projects)
- Agent has project routing context without needing `project list` at session start

### Env Var Normalization — AGENT-19 (COMPLETE)
- `pi_wrapper.ts`: two-phase PI_* ↔ SANDPIPER_* mirroring (SANDPIPER_* takes precedence)
- 4 exempt vars: PI_CODING_AGENT_PACKAGE, PI_CODING_AGENT_VERSION (sandpiper internals), PI_PACKAGE_DIR, PI_SKIP_VERSION_CHECK (pi behavior controls)
- New `resolveEnvVar(name)` in sandpiper-ai-core: SANDPIPER_* first → PI_* fallback; exempt vars short-circuit to PI_* (no throw)
- AGENTS.md: developer convention + exempt var table
- README.md: user-facing env var documentation

### TUI Knowledge Base
- `.sandpiper/docs/tui-extension-patterns.md`: comprehensive reference covering notify vs setWidget vs custom message renderers, component catalog, theme colors, Pi internal patterns, timing/placement, decision guide
- AGENTS.md: new TUI Development section with resource lookup table

## In Progress
- Nothing — all work committed and pushed to main

## Next Session
1. **SHR-62** (MEDIUM) — Long write-chars injections may wrap and confuse fish parser
2. **SHR-63** (MEDIUM) — First command after setup often times out (prompt_ready race condition)
3. **MEM-1** or **PKM-1** (MEDIUM) — Memory/PKM design work
4. **AGENT-16** (LOW) — TUI rebranding — custom assets and theming

## Blockers
- `pi.sendUserMessage()` doesn't route through slash command pipeline (upstream pi bug)
- Sandpiper not published to npm — blocks self-update notification

## Context
- **Edit source skills, not dist** — edit `skills/sandpiper/`, run `bash devtools/postinstall.sh`.
- **`sandpiper-tasks` binary** — after CLI changes: `bun run --filter sandpiper-tasks-cli build` AND `bash devtools/postinstall.sh`.
- **Widget MAX_WIDGET_LINES limit** — applies only to string arrays, NOT factory functions.
- **Session identity** — `SANDPIPER_SESSION_ID` and `SANDPIPER_SESSION_FILE` injected at `session_start`.
- **Project triggers in system prompt** — `<available_projects>` block injected automatically; no need for `project list` at session start.
- **Env vars** — use `resolveEnvVar('NAME')` from sandpiper-ai-core, not `process.env.PI_*` directly (except the 4 exempt vars).
- **Update banner timing** — fire-and-forget (`checkForUpdates().then(...)`) ensures it appears after startup info.
- **TUI patterns** — read `.sandpiper/docs/tui-extension-patterns.md` before doing TUI work.
