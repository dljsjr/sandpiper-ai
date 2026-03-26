---
title: "General-purpose background process/task framework for the agent"
status: NOT STARTED
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-26T15:44:16.494Z
updated_at: 2026-03-26T15:44:16.494Z
related:
  - SHR-71
---

# General-purpose background process/task framework for the agent

A process supervisor library that lets the agent run arbitrary long-running tasks in the background without blocking the chat. Builds on top of the PTY adapter work in SHR-71.

## Motivation

Two distinct use cases motivate this:

### 1. Replace ghost-attach + --create-background for Zellij

Currently the shell relay creates a detached Zellij session (`--create-background`) and attaches a headless ghost client via an Expect script (`ghost-attach`). A process supervisor could replace this backgrounding mechanism — creating an in-process Zellij session that we attach to, can inspect in-memory, and manage directly from TypeScript. This doesn't replace Zellij itself (we still want the shared terminal the user can see), just the way we background it.

This could also potentially replace the shell integration scripts (`relay.{fish,bash,zsh}`) with TypeScript-side orchestration, since we'd have direct PTY control.

### 2. General background tasks unrelated to the shell relay

The agent should be able to run tasks that take a long time (30+ minute test suites, long builds, data processing) while continuing to work on other things. This is a general agent capability, not shell-relay-specific. Examples:
- Kick off a test suite and keep coding
- Start a build and check on it later
- Run multiple concurrent tasks

Neither background processes nor subagents are built into Pi today. This framework would be a stepping stone toward both.

## Design Direction

Informed by the OpenClaw investigation (`.sandpiper/docs/openclaw-process-supervisor-investigation.md`):
- Adapter pattern: `SpawnProcessAdapter` interface with `child` and `pty` implementations
- In-memory state machine: `starting → running → exiting → exited`
- Timeout enforcement (overall + no-output)
- Graceful kill-tree (SIGTERM → grace → SIGKILL)
- Lean implementation (~400-600 lines) in a framework-independent package
- Pi extension tool as a thin glue layer

## Not in Scope (Yet)

- Subagent orchestration (related but separate concept)
- Disk persistence for sessions across restarts
- Windows support

## References

- SHR-71 — PTY MVP (prerequisite)
- SHR-70 — completed investigation spike
- `.sandpiper/docs/openclaw-process-supervisor-investigation.md` — full analysis
- OpenClaw `src/process/supervisor/` — reference implementation (adapt concepts, don't vendor)

