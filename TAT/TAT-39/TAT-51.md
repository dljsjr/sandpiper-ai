---
title: "Expose Chorus participants in model content and details"
status: NOT STARTED
kind: SUBTASK
priority: LOW
assignee: "Huginn"
reporter: USER
created_at: 2026-05-25T19:12:00.615Z
depends_on:
  - TAT-50
updated_at: 2026-11-19T20:49:26.936Z
---

# Expose Chorus participants in model content and details

Include participant/audience metadata in model-visible Chorus XML/text and structured details. The model should know who can see a reply, and renderers/tools should get details.participants without duplicating source-of-truth logic in send_chorus_reply.

## Parked in backlog triage (2026-11-19)

Tattler v1, with the durable message log folded into it, is the long-term goal and not current work (Doug). Parked at LOW. Design: `.sandpiper/docs/specs/durable-rooms-sizing.md` and `tat-72-audience-snapshot-design.md`, restored on 2026-11-19 from an abandoned change.

Their parent, TAT-39, is COMPLETE, and Trail does not let a subtask of a completed task become active. When v1 starts, move these under TAT-70 or promote them.

---

# Activity Log

## 2026-05-25T19:12:56.905Z

- **assignee**: UNASSIGNED → Huginn

## 2026-05-25T19:17:28.604Z

- **depends_on**: (none) → TAT-50

## 2026-11-19T20:49:08.913Z

- **priority**: MEDIUM → LOW
- **description**: 1 line → updated (5 lines)

## 2026-11-19T20:49:26.936Z

- **description**: 5 lines → updated (7 lines)
