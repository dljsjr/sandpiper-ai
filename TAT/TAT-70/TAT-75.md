---
title: "C5: Demote live nudge to wake/render hint"
status: NOT STARTED
kind: SUBTASK
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-05-27T15:45:36.883Z
depends_on:
  - TAT-73
  - TAT-74
updated_at: 2026-11-19T20:49:10.245Z
---

# C5: Demote live nudge to wake/render hint

Rewire Chorus delivery so the live notification carries no payload custody — the Tattler log + cursor own correctness, Chorus consumes that substrate. Currently live nudge is the delivery path; after this chunk, it becomes a wake/render hint only: 'something happened, go look at the log.' Depends on C3 (TAT-73) and C4 (TAT-74) — the cursor and replay path must be authoritative before demoting the live path.

## Parked in backlog triage (2026-11-19)

Tattler v1, with the durable message log folded into it, is the long-term goal and not current work (Doug). Parked at LOW. Design: `.sandpiper/docs/specs/durable-rooms-sizing.md` and `tat-72-audience-snapshot-design.md`, restored on 2026-11-19 from an abandoned change.

---

# Activity Log

## 2026-05-27T15:45:36.956Z

- **description**: added (1 line)

## 2026-05-27T15:46:02.405Z

- **depends_on**: (none) → TAT-73, TAT-74

## 2026-05-27T15:51:30.428Z

- **description**: updated

## 2026-11-19T20:49:10.245Z

- **priority**: MEDIUM → LOW
- **description**: 1 line → updated (5 lines)
