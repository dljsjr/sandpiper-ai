---
title: "Refactor task-cmd into per-subcommand modules with shared helpers"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-04-01T06:05:06.925Z
updated_at: 2026-04-01T15:14:55.604Z
---

# Refactor task-cmd into per-subcommand modules with shared helpers

Split packages/sandpiper-tasks-cli/src/commands/task-cmd.ts into per-subcommand modules and shared helpers.

Scope:
- Extract each task subcommand into commands/task-*.ts files
- Keep task-cmd.ts as orchestration entrypoint
- Deduplicate option-to-fields and filter building helper logic

Verification:
- bun check
- sandpiper-tasks-cli tests

---

# Activity Log

## 2026-04-01T06:05:26.606Z

- **description**: added (10 lines)

## 2026-04-01T06:12:44.890Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-04-01T06:17:25.601Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-04-01T15:14:55.604Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
