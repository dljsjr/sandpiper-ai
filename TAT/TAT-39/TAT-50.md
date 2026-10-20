---
title: "Add broker-owned participant snapshot to Chorus room posts"
status: NOT STARTED
kind: SUBTASK
priority: LOW
assignee: "Huginn"
reporter: USER
created_at: 2026-05-25T19:12:00.551Z
depends_on:
  - TAT-58
updated_at: 2026-11-19T20:49:26.750Z
---

# Add broker-owned participant snapshot to Chorus room posts

Have the Chorus broker stamp canonical room posts with a best-effort participant/audience snapshot before fanout and local injection. Include display names at minimum; avoid asking agents/tools to populate this. Treat it as a snapshot at fanout time, not stable membership/read-receipt state.

## Parked in backlog triage (2026-11-19)

Tattler v1, with the durable message log folded into it, is the long-term goal and not current work (Doug). Parked at LOW. Design: `.sandpiper/docs/specs/durable-rooms-sizing.md` and `tat-72-audience-snapshot-design.md`, restored on 2026-11-19 from an abandoned change.

Their parent, TAT-39, is COMPLETE, and Trail does not let a subtask of a completed task become active. When v1 starts, move these under TAT-70 or promote them.

---

# Activity Log

## 2026-05-25T19:12:56.850Z

- **assignee**: UNASSIGNED → Huginn

## 2026-05-25T19:17:28.542Z

- **depends_on**: (none) → TAT-58

## 2026-11-19T20:49:08.705Z

- **priority**: MEDIUM → LOW
- **description**: 1 line → updated (5 lines)

## 2026-11-19T20:49:26.750Z

- **description**: 5 lines → updated (7 lines)
