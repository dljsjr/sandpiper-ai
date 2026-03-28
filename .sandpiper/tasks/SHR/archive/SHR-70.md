---
title: "Spike: replace unbuffer-relay with proper PTY allocation approach (incl. OpenClaw process/supervisor evaluation)"
status: COMPLETE
resolution: DONE
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-26T14:54:28.373Z
updated_at: 2026-03-26T15:44:07.179Z
---

# Spike: replace unbuffer-relay with proper PTY allocation approach

The current "enhanced mode" for color preservation uses `unbuffer-relay` — a Tcl/Expect script that wraps the first command in a PTY. This approach has several drawbacks: it requires `tclsh` + the `expect` package on the host, it only gives a PTY to the first binary in a pipeline (builtins silently degrade), and the Tcl dependency is fragile and non-obvious.

Research a cleaner PTY allocation strategy that could replace `unbuffer-relay`. One of the candidate approaches — OpenClaw's process/supervisor subsystem — is worth evaluating not just as a PTY solution but as a general background-task framework that could benefit the agent more broadly.

## Questions to Answer

### PTY allocation options

- What Node.js/Bun APIs are available for PTY allocation (`node-pty`, `@homebridge/node-pty-prebuilt-multiarch`, or native `openpty`)?
- Can PTY allocation be done from the TypeScript side (in the extension) rather than in the shell script, giving us more control?
- What is the `script` command approach (`script -q /dev/null cmd`) — is it available cross-platform (macOS + Linux) and does it avoid the tclsh dependency?
- How does `faketty` / `stdbuf` compare?
- What are the tradeoffs of each approach for our use case: session state preservation (`eval` in the current shell), pipeline support, builtin handling, and cross-shell compatibility?

### OpenClaw process/supervisor evaluation

OpenClaw (MIT-licensed, ~337K stars) has a process/supervisor subsystem (`src/process/supervisor/`) that manages both child processes and PTY sessions via an adapter pattern, with timeout enforcement, graceful kill-tree, and in-memory state tracking. It powers their `exec`/`process` agent tools, which let the agent start long-running tasks in the background and poll for output without blocking the chat.

Initial investigation (`.sandpiper/docs/openclaw-process-supervisor-investigation.md`) suggests the design patterns are excellent but the code itself is tightly coupled to OpenClaw's monorepo internals and overbuilt for our needs. The recommended path is to adapt the concepts into our own lean library rather than vendoring.

- Confirm the investigation's recommendation after hands-on prototyping
- If writing our own: decide whether `@lydell/node-pty` (prebuilt native binaries, full control) or `script -q /dev/null` (zero-dep, limited control) is the right PTY backend for us

## Deliverable

A short write-up (can live in this ticket's description or a doc) comparing all approaches, with a recommended path forward and any implementation notes. No implementation in this ticket — implementation is a follow-on.

If OpenClaw's process/supervisor turns out to be the right call, file a follow-on ticket for the vendoring strategy and integration work.

## References

- `extensions/shell-relay/unbuffer-relay` — current Tcl/Expect implementation
- `extensions/shell-relay/shell-integration/relay.{fish,bash,zsh}` — current `use_unbuffer` detection logic
- `extensions/shell-relay/AGENTS.md` — "Enhanced Mode" section
- [OpenClaw](https://github.com/openclaw/openclaw) `src/process/supervisor/` — MIT-licensed process/PTY management (adapter pattern, timeout enforcement, graceful kill-tree)
- `.sandpiper/docs/openclaw-process-supervisor-investigation.md` — detailed investigation of OpenClaw's architecture, vendoring analysis, and build-vs-buy recommendation


---

# Activity Log

## 2026-03-26T15:44:07.180Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: DONE
