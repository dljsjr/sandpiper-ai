---
title: "Implement current-repo sync and auto-commit/auto-push behavior"
status: NOT STARTED
kind: SUBTASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-04-01T18:02:15.125Z
updated_at: 2026-04-01T18:04:22.997Z
---

# Implement current-repo sync and auto-commit/auto-push behavior

Phase 2 subtask.

Implement sync commands and config-driven auto-commit / auto-push behavior for current-repo separate-branch mode.

## Done when

- `sandpiper tasks sync/push/pull` work for the current-repo separate-branch model
- `auto_commit=false` leaves changes in the task checkout working copy
- `auto_commit=true` commits after mutating operations
- `auto_push=true` pushes after those commits

## Parent

- TCL-87

---

# Activity Log

## 2026-04-01T18:04:22.997Z

- **description**: added (14 lines)
