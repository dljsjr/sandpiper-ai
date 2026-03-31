---
title: "Resurrection-aware shell relay session management"
status: NEEDS REVIEW
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-03-31T14:53:00.592Z
updated_at: 2026-03-31T15:52:00.809Z
---

# Resurrection-aware shell relay session management

Improve shell relay session management to make resumed Sandpiper sessions reconnect to their relay session transparently, while respecting explicit user teardown.

## Desired flow

### Fresh session
1. No stored relay session — derive default name: `relay-<first 8 chars of SANDPIPER_SESSION_ID>`
2. Connect lazily on first `shell_relay` tool call
3. After connecting, persist the chosen name via `pi.appendEntry('shell-relay-session', { sessionName })`

### Resumed session (happy path — reboot, terminal restart)
1. On `session_start`: scan `ctx.sessionManager.getBranch()` for last `customType === 'shell-relay-session'` entry; extract stored session name
2. Run `zellij ls` and check if the stored name appears in any state (running OR EXITED)
3. If present — auto-trigger `setupRelay(storedName)` immediately at `session_start`; `zellij attach --create` handles attach (running), resurrect (EXITED), or create (new) transparently
4. User gets relay back with no manual steps

### Resumed session (edge case — user explicitly deleted the session)
1. Same steps 1-2 above
2. If NOT present in `zellij ls` — session was deliberately removed; fall back to fresh UUID-derived name, connect lazily
3. Do NOT recreate the deleted session automatically

### Distinction: kill-session vs delete-session
- `kill-session` alone — session appears as EXITED in `zellij ls` — we resurrect (user just stopped it temporarily)
- `kill-session` + `delete-session` — session absent from `zellij ls` — we do not recreate it (user explicitly discarded it)

### User-supplied custom session name
- When user picks a session via `/relay-connect`, store it via `appendEntry` as the new source of truth
- On future resumes, treat it the same as a UUID-derived name: check `zellij ls` before reconnecting
- If the custom session is gone from `zellij ls`, fall back to UUID-derived default

### Explicit `session` parameter on `shell_relay` tool call
- If the LLM passes a `session` parameter that differs from stored: notify but proceed
- Store the new name via `appendEntry` for future resumes

## Implementation notes

- Use `pi.appendEntry` (not tool result details) — relay session name is extension-private state, not conversation state; should not participate in LLM context or branch into tool history
- Use `ctx.sessionManager.getBranch()` (not `getEntries()`) when scanning for stored session name, so session tree navigation picks up the correct name for the current branch
- Wire restore logic into `session_start`, `session_switch`, `session_fork`, and `session_tree` events
- `ZellijClient.listSessions()` already exists; use it to check session existence before auto-reconnecting
- If `zellij ls` fails entirely, fall back to lazy connection — do not auto-reconnect blind
- Notification on auto-reconnect: non-blocking `ctx.ui.notify('Shell Relay: reconnected to relay-XXXXXXXX', 'info')`
- `/relay-connect` remains the intentional override path; no TUI prompt needed on auto-connection
- Future enhancement (not this ticket): live Zellij session status feedback in the `/relay-connect` input dialog as user types (running / EXITED / new)

## Out of scope
- Cleaning up accumulated EXITED relay sessions (tracked in SHR-89)

---

# Activity Log

## 2026-03-31T15:45:52.265Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-31T15:52:00.810Z

- **status**: IN PROGRESS → NEEDS REVIEW
