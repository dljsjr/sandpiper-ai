---
title: "Investigate zellij action list-panes for pane discovery and health checks"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-27T20:45:55.495Z
updated_at: 2026-03-28T02:21:17.700Z
---

# Investigate zellij action list-panes for pane discovery and health checks

CONFIRMED in SHR-78 spike: list-panes --json provides rich pane metadata.

Fields include: id, is_focused, title, exited, exit_status, is_held, pane_command,
pane_cwd, cursor_coordinates_in_pane, tab_id, tab_name, pane_rows, pane_columns.

Replaces dump-screen-to-dev-null polling for waitForPane. Can detect pane health,
find panes by command/cwd, and check exit status — all via structured JSON.

---

# Activity Log

## 2026-03-27T21:22:38.479Z

- **description**: added (5 lines)

## 2026-03-28T02:21:17.657Z

- **description**: 5 lines → updated (7 lines)

## 2026-03-28T02:21:17.701Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: DONE
