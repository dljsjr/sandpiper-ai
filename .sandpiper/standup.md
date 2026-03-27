# Session Stand-Up

Updated: 2026-03-27T20:15:00Z
Session: 0e5cb1a4-4133-404a-9c36-6e94354d38c4
Session file: /Users/doug.stephen/.sandpiper/agent/sessions/--Users-doug.stephen-git-sandpiper-ai--/2026-03-27T14-50-08-059Z_0e5cb1a4-4133-404a-9c36-6e94354d38c4.jsonl

## Accomplished

### Banner Styling — AGENT-17 (COMPLETE)
- Final approach: inject DynamicBorder + Text directly into chat container (`tui.children[1]`) via transient setWidget side-effect
- Bordered, flows with chat, non-persistent, no duplication on resume
- Explored and rejected: sendMessage (persisted, duplicates on resume), setWidget (sticky)
- Documented in tui skill, patterns doc, and AGENTS.md

### Standup Skill + Session Identity — AGENT-17 (COMPLETE)
- "session" = agent context window; SANDPIPER_SESSION_ID/FILE env vars

### Project Metadata — TCL-70 (COMPLETE), AGENT-18 (COMPLETE)
- when_to_file → when_to_read rename; `<available_projects>` system prompt injection

### Env Var Normalization — AGENT-19 (COMPLETE)
- Two-phase PI_*/SANDPIPER_* mirror; resolveEnvVar() in core; README + AGENTS docs

### Zellij 0.44 Compat — SHR-74
- dump-screen requires --path flag (broke ghost client attachment)
- listSessions needs --short --no-formatting (ANSI in session names)

### Pi Binary Resolution
- Removed static .pi-binpath caching; wrapper now resolves pi via `which pi` at runtime
- Pi updates immediately reflected without sandpiper reinstall

### Data Recovery
- Restored 12 history diffs, 5 subtask statuses, ~224 lines of tests lost in earlier squash
- Closed stale TCL-53, TCL-63

### Self-Reflection
- New tui skill; updated tasks + jj skills; filed SHR-74, AGENT-20, AGENT-21

### Zellij 0.44 Feature Investigation
- Explored `zellij subscribe` live — viewport stream, fires per re-render, noisy for interactive typing but bulk for injected commands
- Filed SHR-75 through SHR-79 with detailed findings
- Likely hybrid approach: send-keys + list-panes + --pane-id (clear wins), keep FIFOs for exit codes/prompt_ready, evaluate subscribe for output capture

## In Progress
- Nothing committed but unpushed — ready to push

## Next Session
1. **SHR-75** (HIGH) — Prototype subscribe-based output capture
2. **SHR-79** (HIGH) — Architectural decision on Zellij 0.44 adoption strategy
3. **SHR-76/77/78** (MEDIUM) — send-keys, list-panes, --pane-id investigations
4. **AGENT-21** (MEDIUM) — Banner redesign (now COMPLETE via chat container injection, can close)
5. **SHR-62/63** — Fish parser wrapping, prompt_ready race condition

## Blockers
- Sandpiper not published to npm — blocks self-update notification

## Context
- **Pi 0.63.1 active** — wrapper now resolves dynamically via PATH
- **Zellij 0.44.0** — breaking change: dump-screen requires --path, list-sessions outputs ANSI by default
- **Chat container injection** — `tui.children[1]` is the chat container; duck-type with `'addChild' in candidate`; use transient setWidget as entry point
- **New core exports need full restart** — /reload doesn't re-resolve jiti module graph
- **pi.events listeners accumulate on /reload** — deduplicate by key in collectors
- **Edit source skills, not dist** — run `bash devtools/postinstall.sh` after changes
- **sandpiper-tasks binary** — `bun run --filter sandpiper-tasks-cli build` AND postinstall
