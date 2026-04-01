---
title: "Implement task storage config resolution and precedence"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-04-01T18:02:15.059Z
updated_at: 2026-04-01T18:36:42.029Z
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

## 2026-04-01T18:35:35.233Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-04-01T18:36:42.030Z

- **status**: IN PROGRESS → COMPLETE
- **resolution**: DONE
