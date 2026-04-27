---
title: "Implement Tattler v1 runtime claims and handshake receipts"
status: NOT STARTED
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-05-15T03:13:38.383Z
depends_on:
  - TAT-6
updated_at: 2026-05-15T03:13:47.608Z
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

---

# Activity Log

## 2026-05-15T03:13:47.609Z

- **depends_on**: (none) → TAT-6
