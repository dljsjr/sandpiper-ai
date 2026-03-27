# Session Stand-Up

Updated: 2026-03-27T22:00:00Z
Session: 0e5cb1a4-4133-404a-9c36-6e94354d38c4
Session file: /Users/doug.stephen/.sandpiper/agent/sessions/--Users-doug.stephen-git-sandpiper-ai--/2026-03-27T14-50-08-059Z_0e5cb1a4-4133-404a-9c36-6e94354d38c4.jsonl

## Accomplished

### Banner Styling — AGENT-17 (COMPLETE)
- Final approach: inject directly into chat container (`tui.children[1]`) via transient setWidget side-effect
- Bordered, flows with chat, non-persistent, no duplication on resume

### Standup Skill + Session Identity — AGENT-17 (COMPLETE)
- "session" = agent context window; SANDPIPER_SESSION_ID/FILE env vars

### Project Metadata — TCL-70 (COMPLETE), AGENT-18 (COMPLETE)
- when_to_file → when_to_read rename; `<available_projects>` system prompt injection

### Env Var Normalization — AGENT-19 (COMPLETE)
- Two-phase PI_*/SANDPIPER_* mirror; resolveEnvVar() in core; README + AGENTS docs

### Pi Binary Resolution
- Removed static .pi-binpath; wrapper resolves pi via `which pi` at runtime

### Zellij 0.44 Compat — SHR-74
- dump-screen --path flag; listSessions --short --no-formatting
- Preflight dedup by key on /reload

### Background Process Framework — AGENT-15 (COMPLETE)
- ProcessManager in sandpiper-ai-core: spawn, kill, output buffering (tail/clear), exit tracking, acknowledgment
- start_background_process tool: fire-and-forget, returns PID immediately
- check_background_process tool: parameterized polling (status-only default, opt-in stdout/stderr/tail/clear)
- Passive completion notifications via context event injection
- Session shutdown cleanup via killAll()
- 25 unit tests, dogfood-verified end-to-end including context notification
- Dogfood-driven development guideline added to AGENTS.md

### Zellij 0.44 Feature Investigation
- Filed SHR-75 through SHR-79 with detailed findings from docs research
- Design doc at .sandpiper/docs/zellij-044-relay-design.md
- State-sharing mechanism inventory in background-process-framework-design.md

### Data Recovery
- Restored history diffs, subtask statuses, tests lost in earlier squash; 246 CLI tests

### Self-Reflection
- New tui skill; updated tasks + jj skills; closed stale tickets

### Self-Reflection Pass
- tui skill: de-emphasized sendMessage pattern, added persistence warning
- tui-extension-patterns.md: updated decision guide with chat container injection as preferred
- AGENTS.md: updated system.ts description to reflect current patterns
- Closed AGENT-21 (banner redesign — solved via chat container injection)
- Filed AGENT-28 (ProcessManager buffer size limits)

## In Progress
- Nothing — all work committed

## Next Session
1. **SHR-75** (HIGH) — Prototype subscribe-based output capture
2. **SHR-79** (HIGH) — Architectural decision on Zellij 0.44 relay rewrite
3. **SHR-76/77/78** (MEDIUM) — send-keys, list-panes, --pane-id investigations
4. **AGENT-21** (MEDIUM) — Banner redesign ticket (can close — solved via chat container injection)
5. **SHR-62/63** — Fish parser wrapping, prompt_ready race condition

## Blockers
- Sandpiper not published to npm — blocks self-update notification

## Context
- **Pi 0.63.1 active** — wrapper resolves dynamically via PATH
- **Zellij 0.44.0** — dump-screen needs --path; list-sessions needs --short --no-formatting
- **Chat container injection** — `tui.children[1]`; duck-type with `'addChild' in candidate`
- **New core exports need full restart** — /reload doesn't re-resolve jiti module graph
- **Background processes** — `start_background_process` / `check_background_process` tools; context event injects completion notifications; processManager lives at module scope in system.ts
- **Edit source skills, not dist** — run `bash devtools/postinstall.sh` after changes
- **sandpiper-tasks binary** — `bun run --filter sandpiper-tasks-cli build` AND postinstall
- **system.ts is getting large** — AGENT-27 tracks refactoring it into a package
