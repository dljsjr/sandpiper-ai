---
title: "ProcessManager: add process restart / auto-restart support"
status: COMPLETE
resolution: WONTFIX
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-04-01T15:29:52.779Z
updated_at: 2026-11-23T22:02:41.628Z
---

# ProcessManager: add process restart / auto-restart support

The background process framework design doc lists process restart as an open question: 'should the framework support auto-restart on exit? Or is that the consumer's job?'

The current ProcessManager has no restart API. Restart semantics are currently left to callers (they could call spawn() again with the same id after acknowledging the exit).

## Design questions to resolve

1. Should restart be opt-in at spawn time (e.g., `restartOnExit?: boolean` in SpawnOptions)?
2. Should there be a max restart count and/or backoff?
3. How does restart interact with the acknowledgment system — should automatic restarts suppress the completion notification?
4. Should there be a `restart(id)` imperative API for manual re-launch?

## References

- `packages/core/src/process-manager.ts` — ProcessManager implementation
- `.sandpiper/archive/background-process-framework-design-2026-04.md` — Open Questions section, item 2
- AGENT-28 — related: buffer size limits

## Closed in backlog triage (2026-11-19)

No need has come up; a caller can start the same id again after an exit.

---

# Activity Log

## 2026-04-01T15:30:48.405Z

- **description**: added (16 lines)

## 2026-11-19T18:58:27.950Z

- **description**: 16 lines → updated (20 lines)

## 2026-11-19T18:58:29.576Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: UNRESOLVED → WONTFIX

## 2026-11-23T22:02:41.628Z

- **description**: updated
