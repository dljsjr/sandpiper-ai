---
title: "Web app for task board"
status: NOT STARTED
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-23T03:18:38.927Z
depends_on:
  - TCL-57
updated_at: 2026-03-23T03:19:16.523Z
---

# Web app for task board

Build a simple web application for viewing and interacting with the task board.

This could be:
- A standalone local web server (serve the board from the .sandpiper/tasks directory)
- A Pi extension that serves a web UI via Bun.serve or similar
- A static HTML page that reads the index file

Should share the board data model from TCL-57 and provide:
- Visual board with drag-and-drop
- Task detail view
- Filtering and search
- Real-time updates (watch for file changes)

Depends on the board data model from TCL-57.

---

# Activity Log

## 2026-03-23T03:19:16.523Z

- **description**: added (14 lines)
- **depends_on**: (none) → TCL-57
