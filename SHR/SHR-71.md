---
title: "Replace unbuffer-relay with @lydell/node-pty PTY adapter"
status: COMPLETE
resolution: WONTFIX
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-26T15:44:11.246Z
updated_at: 2026-03-31T15:26:50.366Z
related:
  - SHR-68
  - SHR-69
---

# Replace unbuffer-relay with @lydell/node-pty PTY adapter

Replace the current Tcl/Expect `unbuffer-relay` script with a TypeScript-side PTY adapter using `@lydell/node-pty` (prebuilt native binaries, no compiler needed). This removes the `tclsh` + `expect` dependency and gives us programmatic control over PTY allocation from the extension.

## Background

Investigation in SHR-70 evaluated multiple approaches and concluded:
- `@lydell/node-pty` is the right PTY backend (prebuilts, full lifecycle control, stdin support)
- Write our own lean adapter rather than vendoring OpenClaw's process/supervisor
- Full analysis: `.sandpiper/docs/openclaw-process-supervisor-investigation.md`

## Scope

This is the **PTY MVP only** — replace unbuffer-relay, nothing more. Background process framework (AGENT-15) is a separate follow-on effort.

- Add `@lydell/node-pty` as a dependency
- Create a PTY adapter module in the shell relay extension (or a shared package if the interface is clean enough to reuse)
- Wire it into the shell integration scripts to replace `$SHELL_RELAY_UNBUFFER` usage
- Remove `unbuffer-relay` (the Tcl/Expect script) and `tclsh` detection logic from the shell integration scripts
- Update the `use_unbuffer` detection in `relay.{fish,bash,zsh}` to use the new approach
- Preserve existing behavior: session state via `eval`, color output for the first command in a pipeline, builtins degrade gracefully
- Tests for the PTY adapter

## References

- `extensions/shell-relay/unbuffer-relay` — current Tcl/Expect implementation to replace
- `extensions/shell-relay/shell-integration/relay.{fish,bash,zsh}` — `use_unbuffer` detection logic
- `extensions/shell-relay/AGENTS.md` — "Enhanced Mode" section
- `.sandpiper/docs/openclaw-process-supervisor-investigation.md` — PTY approach comparison and `@lydell/node-pty` evaluation
- SHR-70 — completed investigation spike


---

# Activity Log

## 2026-03-31T15:26:50.366Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: WONTFIX
