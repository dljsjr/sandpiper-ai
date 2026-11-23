---
title: "Implement delegation/decision-ownership protocol in sandpiper-chorus integration"
status: NOT STARTED
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: USER
created_at: 2026-05-27T03:20:28.911Z
related:
  - TAT-66
  - TAT-68
blocked_by:
  - TAT-70
updated_at: 2026-11-23T22:02:42.798Z
---

# Implement delegation/decision-ownership protocol in sandpiper-chorus integration

Implement the multi-agent delegation + decision-ownership protocol in the Sandpiper/Chorus integration code, using the coordination playbook delivered in TAT-66 as design guidelines. DEFERRED until the durable-rooms v1 rebuild supplants the messaging internals, so the protocol is designed against the new room substrate (durable append-only room log + per-agent SQLite cursors) rather than the current pending-batch guts. Sequence after durable-rooms v1 chunks 1-4. Set blocked-by once durable-rooms v1 tickets exist (post spec-review breakdown).

## Parked in backlog triage (2026-11-19)

Tattler v1, with the durable message log folded into it, is the long-term goal and not current work (Doug). Parked at LOW. Design: `.sandpiper/docs/specs/durable-rooms-sizing.md` and `tat-72-audience-snapshot-design.md`, restored on 2026-11-19 from an abandoned change.

---

# Activity Log

## 2026-05-27T03:20:37.148Z

- **related**: (none) → TAT-66, TAT-68

## 2026-05-27T15:46:02.575Z

- **blocked_by**: (none) → TAT-70

## 2026-11-19T20:49:09.304Z

- **priority**: MEDIUM → LOW
- **description**: 1 line → updated (5 lines)

## 2026-11-23T22:02:42.798Z

- **description**: updated
