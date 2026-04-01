---
title: "Design board data model with swimlanes"
status: NOT STARTED
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-23T03:18:38.864Z
updated_at: 2026-04-01T16:30:37.092Z
---

# Design board data model with swimlanes

Design a data model for a task board with swimlanes, supporting both TUI and web rendering.

The board model should support:
- Configurable swimlanes (by status, by assignee, by priority, by project, or custom)
- Card representation of tasks with key metadata visible
- Drag-and-drop semantics (what fields change when moving between lanes)
- Filtering and grouping within the board view
- Subtask expansion/collapse
- Relationship visualization (dependency arrows, blocked indicators)

Output: a data model specification that can be consumed by both the Pi TUI integration (TCL-58) and the web app (TCL-59).

---

# Activity Log

## 2026-03-23T03:19:16.465Z

- **description**: added (11 lines)

## 2026-04-01T16:30:37.092Z

- **priority**: LOW → MEDIUM
