---
title: "C6: Compatibility fallback for pending-batch migration"
status: NOT STARTED
kind: SUBTASK
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-05-27T15:45:50.465Z
depends_on:
  - TAT-75
updated_at: 2026-11-19T20:49:10.445Z
---

# C6: Compatibility fallback for pending-batch migration

Keep the pending-batch path as a migration fallback so nothing regresses during cutover. Durable Tattler log is authoritative once live; during migration the log is truth and pending-batch is read-only fallback for pre-cutover messages. Avoid dual-write drift. Explicit cutover design before coding. Depends on C5 (TAT-75) — the live-nudge demotion must be in place before the fallback path is narrowed.

## Parked in backlog triage (2026-11-19)

Tattler v1, with the durable message log folded into it, is the long-term goal and not current work (Doug). Parked at LOW. Design: `.sandpiper/docs/specs/durable-rooms-sizing.md` and `tat-72-audience-snapshot-design.md`, restored on 2026-11-19 from an abandoned change.

---

# Activity Log

## 2026-05-27T15:45:50.537Z

- **description**: added (1 line)

## 2026-05-27T15:46:02.462Z

- **depends_on**: (none) → TAT-75

## 2026-05-27T15:51:33.298Z

- **description**: updated

## 2026-11-19T20:49:10.445Z

- **description**: 1 line → updated (5 lines)
