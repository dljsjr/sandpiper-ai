---
title: "Draft Tattler v1 mini-spec from validation findings"
status: NOT STARTED
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: USER
created_at: 2026-05-15T03:13:38.266Z
depends_on:
  - TAT-1
updated_at: 2026-11-19T20:49:07.723Z
---

# Draft Tattler v1 mini-spec from validation findings

After the v0 spike is dogfooded, turn the accepted design into a compact implementation spec.

Scope:
- Reconcile spike findings with the current architecture notes.
- Define v1 JSON formats and schemas for claim, greeting, agent-message, ack, and error.
- Decide which v0 shortcuts are intentionally discarded.
- Keep validation spike, first MVP, hardening, and Broadcast MVP explicitly separated.

Depends on: TAT-1.

## Parked in backlog triage (2026-11-19)

Tattler v1, with the durable message log folded into it, is the long-term goal and not current work (Doug). Parked at LOW. Design: `.sandpiper/docs/specs/durable-rooms-sizing.md` and `tat-72-audience-snapshot-design.md`, restored on 2026-11-19 from an abandoned change.

---

# Activity Log

## 2026-05-15T03:13:47.511Z

- **depends_on**: (none) → TAT-1

## 2026-11-19T20:49:07.723Z

- **priority**: MEDIUM → LOW
- **description**: 9 lines → updated (13 lines)
