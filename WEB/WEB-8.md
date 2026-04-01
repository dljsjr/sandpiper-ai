---
title: "Wire ctx.signal into web_fetch for user-cancellable fetches"
status: NOT STARTED
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-03-30T02:04:34.128Z
updated_at: 2026-03-30T02:04:45.101Z
---

# Wire ctx.signal into web_fetch for user-cancellable fetches

The `web_fetch` tool currently ignores the `signal` parameter in its `execute` function. `SimpleFetchAdapter` creates its own `AbortController` with a 30s timeout, but there is no way to cancel an in-flight HTTP request when the user presses Escape mid-turn.

With pi 0.63.2, `ctx.signal` is now available in extension tool handlers — it is the active agent turn's AbortSignal, fired on user cancellation. Wiring it in would let Escape immediately abort a slow or hanging fetch instead of waiting up to 30 seconds.

## Changes Required

- `FetchOptions` gains an optional `signal?: AbortSignal` field
- `SimpleFetchAdapter.fetch()` composes the external signal with its own timeout using `AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])`
- The `web_fetch` tool `execute()` passes its `signal` argument (the `ctx.signal` from the tool signature) through to the adapter
- Existing timeout behaviour is unchanged when no external signal is provided
- Tests cover the signal composition path (cancelled before timeout, timed out without external signal)

---

# Activity Log

## 2026-03-30T02:04:45.101Z

- **description**: added (11 lines)
