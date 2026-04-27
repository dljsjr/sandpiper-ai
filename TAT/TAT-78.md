---
title: "Track 3: Refactor Chorus as consumer of Tattler durable primitives"
status: NOT STARTED
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-05-27T15:51:59.546Z
blocked_by:
  - TAT-70
related:
  - TAT-69
updated_at: 2026-05-27T15:51:59.645Z
---

# Track 3: Refactor Chorus as consumer of Tattler durable primitives

Refactor Chorus to be a consumer of Tattler's durable substrate rather than owning its own messaging guts. Broker-less, session-decoupled. Chorus owns coordination semantics (fanout, audience) on top of the Tattler log + cursor, not the persistence layer itself. This is serial post-Track 1 (C1–C6). Supersedes TAT-69 (delegation protocol) — that work should target the new consumer architecture, not the current broker internals. TUI overhaul for Chorus-specific rendering lives here, separate from Track 2's standalone read-only TUI.

---

# Activity Log

## 2026-05-27T15:51:59.646Z

- **description**: added (1 line)
- **blocked_by**: (none) → TAT-70
- **related**: (none) → TAT-69
