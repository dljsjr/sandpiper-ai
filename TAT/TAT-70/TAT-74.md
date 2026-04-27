---
title: "C4: read-from-cursor unread API and replay tool (Tattler layer)"
status: NOT STARTED
kind: SUBTASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-05-27T15:45:33.856Z
depends_on:
  - TAT-71
  - TAT-73
updated_at: 2026-05-27T15:53:54.549Z
---

# C4: read-from-cursor unread API and replay tool (Tattler layer)

Read-since-cursor tool at the Tattler layer, replacing pending-batch reconstruction. MVP is explicit-fork only: the agent calls read-from-cursor, gets messages, processes them, cursor advances on tool-call success. No auto-deliver at turn start in MVP — the agent decides when to read, which makes reasoning about state simple, observable, and debuggable. Matches the standalone TUI's natural interaction model (shows N unread, agent reads on demand). Auto-deliver can be added later as an opt-in without breaking the explicit path. Define a replay envelope distinct from live DM format — live delivery stays tiny; historical replay carries timestamps + author handles for temporal context. Depends on C1 (TAT-71) and C3 (TAT-73).

Acceptance criteria:
- read-from-cursor tool returns messages since agent's cursor position
- Replay envelope includes timestamps + author handles (distinct from live DM format)
- Cursor advances on tool-call success (batch-atomic, per TAT-73 semantics)
- No auto-deliver at turn start in MVP
- Standalone TUI (TAT-77) can query unread count for display

---

# Activity Log

## 2026-05-27T15:45:33.943Z

- **description**: added (1 line)

## 2026-05-27T15:46:02.348Z

- **depends_on**: (none) → TAT-71, TAT-73

## 2026-05-27T15:51:27.240Z

- **title**: C4: read-from-cursor unread API and replay tool → C4: read-from-cursor unread API and replay tool (Tattler layer)
- **description**: updated

## 2026-05-27T15:53:54.549Z

- **description**: 1 line → updated (8 lines)
