# Session Stand-Up

Updated: 2026-03-30T20:02:20Z
Session: 0e5cb1a4-4133-404a-9c36-6e94354d38c4
Session file: /Users/doug.stephen/.sandpiper/agent/sessions/--Users-doug.stephen-git-sandpiper-ai--/2026-03-27T14-50-08-059Z_0e5cb1a4-4133-404a-9c36-6e94354d38c4.jsonl

## Accomplished

This was an enormous session covering banner styling, framework infrastructure, and a complete shell relay rewrite.

### Banner Styling — AGENT-17 (COMPLETE)
- Final approach: inject DynamicBorder + Text into chat container (`tui.children[1]`)
- Bordered, flows with chat, non-persistent, no duplication on resume

### Session Continuity — AGENT-17 (COMPLETE)
- Standup skill rewrite: "session" = agent context window
- SANDPIPER_SESSION_ID/FILE env vars injected at session_start

### Project Metadata — TCL-70 (COMPLETE), AGENT-18 (COMPLETE)
- when_to_file → when_to_read rename
- `<available_projects>` XML auto-injected into system prompt

### Env Var Normalization — AGENT-19 (COMPLETE)
- Two-phase PI_*/SANDPIPER_* mirror; resolveEnvVar() in core
- Pi binary resolved dynamically via PATH (removed .pi-binpath caching)

### Background Process Framework — AGENT-15 (COMPLETE)
- ProcessManager: spawn, kill, output buffering, exit tracking, acknowledgment
- start/check_background_process tools; context event completion notifications
- 25 unit tests; dogfood-verified end-to-end

### Shell Relay Rewrite — SHR-79 (COMPLETE)
- **Eliminated:** ghost-attach (tclsh/expect), unbuffer-relay, stdout/stderr FIFOs, write-chars, ZELLIJ_SESSION_NAME env var
- **New:** paste + send-keys, --session + --pane-id targeting, list-panes --json, snapshot-diff output capture
- **Viewport fix (SHR-85):** attach-then-detach pattern for wide terminal dimensions (141x70 vs 50x49)
- **Investigations:** SHR-75 through SHR-78 all completed — confirmed ghost client elimination, paste/send-keys, list-panes, subscribe capabilities
- 12 snapshot-diff tests, 22 ZellijClient tests, 154 total shell-relay tests

### Zellij 0.44 Compat — SHR-74
- dump-screen --path flag; listSessions --short --no-formatting
- Preflight dedup by key on /reload

### Other
- Data recovery from bad squash (history diffs, task statuses, tests)
- TUI skill + patterns doc; self-reflection passes
- AGENT-21 banner redesign closed; AGENT-27 system.ts refactor filed
- **TOOLS-10 cleanup validated:** shell-relay and web-fetch both load successfully from source via jiti after full reinstall/restart
- **Doc hygiene sweep:** cleaned stale built-extension assumptions from repo docs; rewrote `extensions/shell-relay/README.md`; updated `README.md`, `extensions/README.md`, `.sandpiper/docs/build-system.md`, `.sandpiper/docs/extension-loading.md`, and `extensions/shell-relay/AGENTS.md`; marked old shell-relay PRD/workplan docs as historical/superseded
- **SHR-87 / SHR-88:** simplified shell integration scripts to signal-only behavior, removed legacy shell-relay artifacts (`ghost-client.ts`, `relay.ts`, `ghost-attach`, `unbuffer-relay`, related tests), and validated relay still works
- **TOOLS-12:** simplified root package metadata after extension unbundling (removed root dependency declarations for shell-relay/web-fetch and stale root relay bins)
- **TOOLS-13 filed:** backlog follow-up to verify source-loaded extension dependency resolution in publish-style installs
- **AGENT-34 planned / AGENT-35 filed:** documented the next agent-guidance iteration in `.sandpiper/docs/agent-guidance-evolution.md`, with a prompt-first progressive-disclosure plan and a deferred memo of current hook/enforcement findings for later design work

### Self-Reflection
- Updated shell-relay AGENTS.md for new architecture (removed ghost client, unbuffer, old FIFO patterns)
- Updated Zellij design doc with viewport sizing discovery
- Filed SHR-86 (snapshot-diff echo leak), SHR-87 (shell integration simplification), SHR-88 (legacy code removal)
- Skills reviewed: tui, jj, tasks, standup, fifo-patterns — all accurate, no changes needed

## In Progress
- Nothing — all work committed and pushed

## Next Session
1. **Snapshot-diff edge case:** long escaped commands leak __relay_run echo — needs refinement
2. **SHR-62** — Long write-chars injections (now paste) wrapping
3. **SHR-63** — prompt_ready race condition
4. **AGENT-35** — review the deferred hook/enforcement memo when ready to design deterministic tool guidance
5. **TOOLS-13** — verify source-loaded extension dependency resolution in publish-style installs
6. **MEM-1** or **PKM-1** — Memory/PKM design work

## Blockers
- Sandpiper not published to npm — blocks self-update notification

## Context
- **Relay rewrite is live** — no ghost client, no expect/tclsh, no stdout/stderr FIFOs. Uses paste + send-keys, --session + --pane-id, snapshot-diff output capture
- **Viewport sizing** — sessions created via attach-then-detach to inherit terminal dimensions; createBackgroundSession still available but produces 50x49
- **Shell integration is now signal-only** — relay.fish/bash/zsh provide prompt_ready + exit code signals via `SHELL_RELAY_SIGNAL`; no stdout/stderr/unbuffer compat shim remains
- **Background processes** — start/check_background_process tools; context event notifications; processManager at module scope in system.ts
- **Chat container injection** — `tui.children[1]`; duck-type with `'addChild' in candidate`
- **New core exports need full restart** — /reload doesn't re-resolve jiti module graph
- **system.ts is large** — AGENT-27 tracks refactoring into a package
- **Agent-guidance planning doc:** `.sandpiper/docs/agent-guidance-evolution.md` captures the prompt-first revision plan plus deferred deterministic hook findings; use it as the entry point for future guidance work
- **Edit source skills, not dist** — run `bash devtools/postinstall.sh`
- **Extensions now load from source via jiti** — extension changes need `bash devtools/postinstall.sh`, not per-extension build steps
- **shell-relay docs were stale and are now aligned** — historical shell-relay PRD/workplan/review artifacts were moved to `.sandpiper/archive/shell-relay/`; current sources of truth are `extensions/shell-relay/README.md`, `extensions/shell-relay/AGENTS.md`, and `.sandpiper/docs/zellij-044-relay-design.md`
- **sandpiper-tasks binary** — `bun run --filter sandpiper-tasks-cli build` AND postinstall
- **CLI/core package changes** — build the affected package if it emits binaries or declarations, then run postinstall
