---
title: "Implement task storage config resolution and precedence"
status: NOT STARTED
kind: SUBTASK
priority: HIGH
assignee: UNASSIGNED
reporter: USER
created_at: 2026-04-01T18:02:15.059Z
updated_at: 2026-04-01T18:04:22.924Z
---

# Implement task storage config resolution and precedence

Phase 2 subtask.

Implement task storage config resolution and precedence.

## Required precedence

1. `.sandpiper-tasks.json`
2. `.sandpiper/settings.json` → `tasks`
3. defaults

## Done when

- both config locations are supported
- standalone config overrides the sandpiper settings block
- config parsing is documented and tested

## Parent

- TCL-87

---

# Activity Log

## 2026-04-01T18:04:22.924Z

- **description**: added (19 lines)
