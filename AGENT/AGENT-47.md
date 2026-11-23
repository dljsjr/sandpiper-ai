---
title: "ProcessManager: design multi-consumer output broadcast pattern"
status: COMPLETE
resolution: WONTFIX
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-04-01T15:29:52.812Z
updated_at: 2026-11-23T22:02:46.984Z
---

# ProcessManager: design multi-consumer output broadcast pattern

## Closed with the Shell Relay retirement (2026-11-10)

Doug decided to remove Shell Relay (TOOLS-93). This task existed because the relay extension would have been a second consumer of a background process output stream. With the extension gone there is one consumer, so the broadcast design is not needed. Reopen it if a second consumer appears.

The background process framework design doc lists multiple consumers as an open question: 'if both the relay extension and a tool call want the same process's output, how do we handle that? Broadcast vs. single reader?'

Currently the ProcessManager buffers stdout/stderr per process and exposes them through `get(id)` → `readStdout()` / `readStderr()`. This is a single-reader model — whoever calls readStdout gets the same buffered content, but there's no fan-out.

## Concrete motivating case

The shell relay extension might want to consume a process's stdout stream for its own signaling logic while the agent's check_background_process tool also wants to read output. Today both callers share the same buffer (no problem for reads) but if clear: true is passed, one consumer clears data the other hasn't seen.

## Design questions to resolve

1. Is the current shared-buffer model sufficient, or do we need true broadcast (each consumer gets its own cursor)?
2. If broadcast: should consumers register at spawn time or be able to subscribe later?
3. How does this interact with the clear option on readStdout/readStderr?

## References

- `packages/core/src/process-manager.ts` — ManagedProcess.readStdout / readStderr
- `.sandpiper/archive/background-process-framework-design-2026-04.md` — Open Questions section, item 3
- AGENT-28 — related: buffer size limits

---

# Activity Log

## 2026-04-01T15:30:58.706Z

- **description**: added (19 lines)

## 2026-06-03T04:43:52.490Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → Huginn

## 2026-06-03T04:44:12.486Z

- **status**: IN PROGRESS → NOT STARTED
- **assignee**: Huginn → UNASSIGNED

## 2026-11-10T16:08:54.317Z

- **description**: 19 lines → updated (23 lines)

## 2026-11-10T16:08:54.440Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: WONTFIX

## 2026-11-23T22:02:46.984Z

- **description**: updated
