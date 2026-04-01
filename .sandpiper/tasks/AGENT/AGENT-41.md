---
title: "Add tests for extracted extensions/system modules"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-04-01T06:05:06.984Z
updated_at: 2026-04-01T15:14:55.404Z
---

# Add tests for extracted extensions/system modules

Add focused tests for extracted extensions/system modules that currently have no direct coverage.

Target modules:
- background-process-tools.ts
- diagnostics-hooks.ts
- migration-controls.ts
- startup-hooks.ts

Coverage expectations:
- happy path + primary error path for each module
- hook/command registration assertions

---

# Activity Log

## 2026-04-01T06:05:26.665Z

- **description**: added (11 lines)

## 2026-04-01T06:18:44.373Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-04-01T06:24:31.208Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-04-01T14:25:02.455Z

- **status**: NEEDS REVIEW → IN PROGRESS

## 2026-04-01T14:53:43.747Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-04-01T15:14:55.404Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
