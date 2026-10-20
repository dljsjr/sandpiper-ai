---
title: "Add automated Tattler v0 protocol and identity tests"
status: NOT STARTED
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-05-20T06:25:56.136Z
updated_at: 2026-11-19T20:49:26.372Z
---

# Add automated Tattler v0 protocol and identity tests

Dogfood exposed several regressions that focused tests would catch: missing serialized format fields after type-level branding, stale identity files listing dead sockets, and startup paths that can leave a socket alive without identity/tool registration. Add focused tests around protocol frame serialization/parsing, send ACK/ERR settlement, identity-file discovery liveness, and startup failure handling without touching real user runtime state.

## Narrowed in backlog triage (2026-11-19)

Covered since filing: ACK/ERR settlement and room frames (`tattler-ipc.test.ts`, `tattler-protocol.test.ts`), `/reload` and `/new` survival and identity-file cleanup (`index.test.ts`), and a real send between two sessions (TAT-83). Remaining: (1) identity-file discovery lists only peers whose socket is live, and (2) a startup failure does not leave a socket listening without its identity file or tools.

---

# Activity Log

## 2026-11-19T20:49:11.016Z

- **description**: 1 line → updated (5 lines)

## 2026-11-19T20:49:26.372Z

- **kind**: SUBTASK → TASK
- **parent**: TAT-1 → (none)
