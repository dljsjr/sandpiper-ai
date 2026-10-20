---
title: "Broadcast MVP: durable global and project channels"
status: NOT STARTED
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: USER
created_at: 2026-05-15T03:13:38.495Z
depends_on:
  - TAT-6
updated_at: 2026-11-19T20:49:08.507Z
---

# Broadcast MVP: durable global and project channels

Near-term post-MVP backlog item for durable broadcast/channel coordination.

Scope:
- User-global and cwd/project broadcast scopes.
- Durable append-only channel history with compact immutable records.
- Broadcast tools for post/list/read/reply/reference.
- Startup participation and live fan-out to online participants.
- Storage evaluation optimized for latency, disk usage, and inspectability.

Non-goal: include this in the first ephemeral messaging MVP.

## Parked in backlog triage (2026-11-19)

Tattler v1, with the durable message log folded into it, is the long-term goal and not current work (Doug). Parked at LOW. Design: `.sandpiper/docs/specs/durable-rooms-sizing.md` and `tat-72-audience-snapshot-design.md`, restored on 2026-11-19 from an abandoned change.

---

# Activity Log

## 2026-05-15T03:13:47.707Z

- **depends_on**: (none) → TAT-6

## 2026-11-19T20:49:08.507Z

- **description**: 10 lines → updated (14 lines)
