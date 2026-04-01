---
title: "ProcessManager: design multi-consumer output broadcast pattern"
status: NOT STARTED
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-04-01T15:29:52.812Z
updated_at: 2026-04-01T15:30:58.706Z
---

# ProcessManager: design multi-consumer output broadcast pattern

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
- `.sandpiper/docs/background-process-framework-design.md` — Open Questions section, item 3
- AGENT-28 — related: buffer size limits

---

# Activity Log

## 2026-04-01T15:30:58.706Z

- **description**: added (19 lines)
