# Session Stand-Up

Updated: 2026-04-01T05:08:28Z
Session: 0e5cb1a4-4133-404a-9c36-6e94354d38c4
Session file: /Users/doug.stephen/.sandpiper/agent/sessions/--Users-doug.stephen-git-sandpiper-ai--/2026-03-27T14-50-08-059Z_0e5cb1a4-4133-404a-9c36-6e94354d38c4.jsonl

## Accomplished

### Shell Relay Stabilization
- **SHR-89:** Implemented `/relay-cleanup` slash command for explicit stale session cleanup.
  - Lists EXITED `relay-*` sessions via `zellij list-sessions --no-formatting`
  - Confirms before deletion
  - Uses new `ZellijClient.deleteSession()`
- Restored **auto-connect on startup** behavior (kept `setStatus`, no `notify` footer spam)
- **SHR-86:** Fixed snapshot-diff `__relay_run` echo leak for long wrapped escaped commands.
  - Root cause: trimming significant trailing spaces before marker matching
  - Fix: preserve wrapped line endings during marker search/boundary mapping
  - Added regression test for wrapped fish quote-break payload
- **SHR-62:** Updated deprecated `writeChars()` shim to route through `paste()` instead of `action write-chars` to avoid wrapping/parser issues.
- **SHR-63:** Eliminated first-command race by buffering signal events.
  - `SignalParser.waitFor()` now consumes matching buffered events that arrived before listener registration
  - Added regression test

### Fish Heredoc Investigation
- Reproduced heredoc failure in fish (`Expected a string, but found a redirection`) and confirmed grammar mismatch behavior.
- Reframed follow-up as **SHR-95**: block fish heredoc `shell_relay` calls via generic enforcement API.
- Set **`SHR-95 blocked_by AGENT-35`** (deferred until deterministic enforcement framework exists).

### Startup Prompt / Prefix Caching Maintenance
- **AGENT-38:** Reordered startup prompt assembly to keep static components first, then dynamic components ordered by volatility.
- Initially added a dynamic `Current Date` line, then removed it after confirming the harness already provides date context.
- Final dynamic order (prefix-cache optimized):
  1. project triggers
  2. standup context
  3. active task context
  4. working-copy context
  5. cold-start guidance (one-shot, most volatile, intentionally last)

### Task Hygiene
- Bulk-closed all `NEEDS REVIEW` tasks as `COMPLETE (DONE)`:
  - AGENT-27, AGENT-38
  - SHR-62, SHR-63, SHR-86, SHR-89, SHR-94

### Home-Agent Guidance Update (outside repo)
- Confirmed expanded skill set visibility (19 skills including `gh`, `glab`, `code-review`, `mutation-testing`, etc.).
- Ingested new testing/code-health guidance into `~/.sandpiper/agent/AGENTS.md` with progressive disclosure:
  - concise hot-memory rules in AGENTS
  - routing pointers to leaf docs
  - created:
    - `~/.sandpiper/agent/docs/testing.md`
    - `~/.sandpiper/agent/docs/code-health.md`

### Self-Reflection Persistence
- Updated `skills/sandpiper/tasks/SKILL.md` with a CLI flag gotcha note:
  - `task list` uses `-s/--status`
  - bulk mutating commands use `--filter-status`
- Updated `.sandpiper/docs/agent-guidance-evolution.md` to capture prompt-ordering/cache decision:
  - static-first prompt assembly
  - dynamic ordering by volatility
  - one-shot cold-start guidance appended last for better shared prefix caching

### Key commits from this session window
- `7eef79ff` — Simplify `listSessionsWithStatus` using `--no-formatting`
- `95e9add3` — Snapshot-diff wrapped-marker fix
- `25e87367` — `writeChars` shim routed to paste
- `e84dc58b` — SignalParser buffering race fix
- `0675151a` — Reframe SHR-95 blocked by AGENT-35
- `6afdbbb4` — Prompt ordering optimized without duplicate date line
- `f4e16303` — Move cold-start guidance to end of dynamic startup section
- `1124a6c9` — Bulk close NEEDS REVIEW tasks as COMPLETE

## In Progress
- None.

## Next Session
1. **AGENT-35 (HIGH):** design generic deterministic tool-call enforcement API.
2. Implement **SHR-95** via AGENT-35 API (fish heredoc detection + deterministic rewrite guidance).
3. **TOOLS-13:** verify source-loaded extension dependency resolution in publish-style installs.
4. **TCL-71:** fix dangerous unscoped mutating task/project updates.
5. Optional strategic work: **MEM-1 / PKM-1**.

## Blockers
- Sandpiper not published to npm — still blocks self-update notification path.
- SHR-95 intentionally blocked on AGENT-35.

## Context
- Shell relay is now stable with paste-based injection and buffered signal handling.
- `/relay-cleanup` is available and working.
- Startup prompt now follows static-first, volatility-ordered dynamic assembly (without duplicate date), with one-shot cold-start guidance intentionally appended last for prefix caching.
- `/reload` usually refreshes prompt/extension behavior; full restart may still be needed for some module-graph changes.
- Home-agent global guidance now routes testing/code-health details to dedicated leaf docs.