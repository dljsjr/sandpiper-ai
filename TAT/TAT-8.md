---
title: "Implement Tattler v1 runtime claims and handshake receipts"
status: NOT STARTED
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: USER
created_at: 2026-05-15T03:13:38.383Z
depends_on:
  - TAT-6
updated_at: 2026-11-19T20:49:08.130Z
---

# Implement Tattler v1 runtime claims and handshake receipts

Implement hardened Tattler runtime ownership and IPC receipt semantics after v0 validation.

Scope:
- Runtime root resolution and per-agent claim/socket paths.
- Claim file with exclusive advisory flock for process lifetime.
- Short collision-free socket names.
- Tattler greeting on each stream connection.
- Top-level format-dispatched frames.
- tattler.ack.v1 and tattler.error.v1 runtime receipts.
- Bounded retry behavior for safe connection/greeting failures.

Depends on: TAT-6 / v1 mini-spec.

## Parked in backlog triage (2026-11-19)

Tattler v1, with the durable message log folded into it, is the long-term goal and not current work (Doug). Parked at LOW. Design: `.sandpiper/docs/specs/durable-rooms-sizing.md` and `tat-72-audience-snapshot-design.md`, restored on 2026-11-19 from an abandoned change.

---

# Activity Log

## 2026-05-15T03:13:47.609Z

- **depends_on**: (none) → TAT-6

## 2026-11-19T20:49:08.130Z

- **priority**: MEDIUM → LOW
- **description**: 12 lines → updated (16 lines)
