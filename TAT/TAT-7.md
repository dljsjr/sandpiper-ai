---
title: "Implement stable Tattler agent identity and directory"
status: NOT STARTED
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: USER
created_at: 2026-05-15T03:13:38.326Z
depends_on:
  - TAT-6
updated_at: 2026-11-19T20:49:07.927Z
---

# Implement stable Tattler agent identity and directory

Implement the first-MVP identity layer after v0 validation.

Scope:
- Persist UUIDv4 agentId in session state via appendEntry type sandpiper:agent-identity.
- Support --agent-name <handle> startup registration.
- Support /rename-agent <handle>.
- Store registered global handles in $XDG_STATE_HOME/sandpiper/agents.sqlite3.
- Enforce handle syntax and point-in-time uniqueness.
- Display guests as guest:<short-uuid>.

Depends on: TAT-6 / v1 mini-spec.

## Parked in backlog triage (2026-11-19)

Tattler v1, with the durable message log folded into it, is the long-term goal and not current work (Doug). Parked at LOW. Design: `.sandpiper/docs/specs/durable-rooms-sizing.md` and `tat-72-audience-snapshot-design.md`, restored on 2026-11-19 from an abandoned change.

---

# Activity Log

## 2026-05-15T03:13:47.561Z

- **depends_on**: (none) → TAT-6

## 2026-11-19T20:49:07.927Z

- **priority**: MEDIUM → LOW
- **description**: 11 lines → updated (15 lines)
