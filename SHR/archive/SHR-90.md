---
title: "Wire ctx.signal into shell_relay for user-cancellable command execution"
status: COMPLETE
resolution: WONTFIX
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-03-30T02:04:48.245Z
related:
  - SHR-99
updated_at: 2026-11-10T16:09:10.894Z
---

# Wire ctx.signal into shell_relay for user-cancellable command execution

The `shell_relay` tool's `execute` function accepts a `signal` parameter but names it `_signal` and ignores it. Command execution goes through `executeCommand()` which uses an explicit timeout (`timeoutMs`), so pressing Escape during a long-running relay command has no effect — the turn cannot be cancelled until the timeout fires or the command finishes.

With pi 0.63.2, `ctx.signal` is the active agent turn's AbortSignal. Composing it with the existing command timeout would allow Escape to abort relay command execution immediately.

Lower priority than WEB-8 since relay commands are typically short-lived and the timeout mechanism already provides a safety net. The fetch in `web_fetch` is the more painful case (30s hangable on any slow URL).

## Changes Required

- Thread the `signal` parameter through `executeCommand()` (or compose with an internal `AbortController`)
- When the signal fires, cancel the waiting relay operation (close the pending promise, optionally send a SIGINT to the running shell command via the signal FIFO)
- `shell_relay_inspect` is a screen dump and is already instant — no change needed there

---

# Activity Log

## 2026-03-30T02:04:56.767Z

- **description**: added (11 lines)

## 2026-05-14T14:46:07.958Z

- **related**: (none) → SHR-99

## 2026-11-10T16:09:10.895Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: WONTFIX
