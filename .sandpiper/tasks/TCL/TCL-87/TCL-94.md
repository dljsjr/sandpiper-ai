---
title: "Implement sandpiper tasks init for current-repo jj/git backends"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-04-01T18:02:15.091Z
updated_at: 2026-04-01T18:44:27.865Z
---

# Implement sandpiper tasks init for current-repo jj/git backends

Phase 2 subtask.

Implement explicit `sandpiper tasks init` for current-repo separate-branch mode.

## Required behavior

- jj repo → create `.sandpiper/tasks/` via `jj workspace add ... --revision root()`
- plain git repo → create `.sandpiper/tasks/` via `git worktree`
- establish local bookmark/branch and remote tracking during init
- init is idempotent

## Parent

- TCL-87

---

# Activity Log

## 2026-04-01T18:04:22.963Z

- **description**: added (14 lines)

## 2026-04-01T18:36:53.017Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-04-01T18:44:27.866Z

- **status**: IN PROGRESS → COMPLETE
- **resolution**: DONE
