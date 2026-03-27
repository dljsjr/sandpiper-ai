# Session Stand-Up

Updated: 2026-03-27T18:30:00Z
Session: 0e5cb1a4-4133-404a-9c36-6e94354d38c4
Session file: /Users/doug.stephen/.sandpiper/agent/sessions/--Users-doug.stephen-git-sandpiper-ai--/2026-03-27T14-50-08-059Z_0e5cb1a4-4133-404a-9c36-6e94354d38c4.jsonl

## Accomplished

### Banner Styling — AGENT-17 (COMPLETE)
- Both banners (update notification + diagnostics) now use `pi.registerMessageRenderer` + `pi.sendMessage` — full DynamicBorder styling, flow with chat, not sticky
- Fire-and-forget pattern for update notification ensures it appears after startup info
- Diagnostics deduplication via Map (key-based) fixes listener accumulation on /reload
- Reinstalled real relay.fish (was a stub from an early install run)

### Standup Skill Overhaul — AGENT-17 (COMPLETE)
- "session" = agent context window; session UUID via SANDPIPER_SESSION_ID env var

### Project Metadata Rename — TCL-70 (COMPLETE)
- when_to_file → when_to_read; 229 tests passing

### System Prompt Project Injection — AGENT-18 (COMPLETE)
- `<available_projects>` XML block auto-injected at agent start; ~850 tokens for 9 projects

### Env Var Normalization — AGENT-19 (COMPLETE)
- Two-phase PI_* ↔ SANDPIPER_* mirror; resolveEnvVar() in sandpiper-ai-core
- README.md user-facing docs; AGENTS.md developer convention

### TUI Knowledge — AGENT-17
- New skill: `skills/sandpiper/tui/SKILL.md` — surfaces TUI patterns automatically
- `.sandpiper/docs/tui-extension-patterns.md` — full reference doc
- AGENTS.md TUI Development section with resource lookup table
- Added: event listener accumulation pitfall, new-core-export restart requirement

### Self-Reflection
- tasks SKILL.md: removed stale session-start `project list` instruction (auto-injected now)
- jj SKILL.md: added `jj restore --from` recovery pattern to common pitfalls
- Closed stale TCL-53 (COMPLETE) and TCL-63 (COMPLETE)
- Filed SHR-74 (stub relay.fish mystery), AGENT-20 (filter inactive projects from prompt)

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
- **Edit source skills, not dist** — edit `skills/sandpiper/`, run `bash devtools/postinstall.sh`
- **sandpiper-tasks binary** — after CLI changes: `bun run --filter sandpiper-tasks-cli build` AND `bash devtools/postinstall.sh`
- **New core exports require full restart** — `/reload` doesn't re-resolve jiti module graph
- **Session identity** — SANDPIPER_SESSION_ID and SANDPIPER_SESSION_FILE injected at session_start
- **Project triggers in system prompt** — auto-injected as `<available_projects>`; no manual project list needed
- **Env vars** — use resolveEnvVar('NAME') from sandpiper-ai-core; 4 exempt vars accessed via process.env.PI_* directly
- **TUI patterns** — read `.sandpiper/docs/tui-extension-patterns.md`; new `tui` skill auto-surfaces it
