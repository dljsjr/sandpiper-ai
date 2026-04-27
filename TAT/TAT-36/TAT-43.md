---
title: "Render batched Tattler and Chorus messages as separate blocks"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: "Huginn"
reporter: USER
created_at: 2026-05-25T19:11:37.874Z
depends_on:
  - TAT-42
updated_at: 2026-05-25T19:56:53.341Z
---

# Render batched Tattler and Chorus messages as separate blocks

Implemented in jj changes kzovvtpv / 67fd7bc4 plus hardening qmkvwvyz / 4dc2e03c. Registers a Tattler pending-batch renderer for custom type tattler:pending-batch. Batch messages with any visible item now set display:true, but renderer filters details.messages[] to render only visible Chorus room messages as separate visual blocks; hidden Tattler DMs remain model-visible in canonical content but are not rendered. Invalid/missing/malformed details render empty rather than falling back to raw content. Focused tests cover mixed hidden Tattler DM + multiple visible Chorus messages and malformed {kind:batch} details.

---

# Activity Log

## 2026-05-25T19:12:56.574Z

- **assignee**: UNASSIGNED → Huginn

## 2026-05-25T19:17:28.160Z

- **depends_on**: (none) → TAT-42

## 2026-05-25T19:49:00.686Z

- **status**: NOT STARTED → IN PROGRESS

## 2026-05-25T19:52:52.419Z

- **description**: updated

## 2026-05-25T19:52:52.487Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-25T19:56:53.274Z

- **description**: updated

## 2026-05-25T19:56:53.342Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
