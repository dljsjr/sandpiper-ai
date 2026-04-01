---
title: "Add tests for extracted task subcommands and command helpers"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-04-01T06:05:07.016Z
updated_at: 2026-04-01T15:14:55.638Z
---

# Add tests for extracted task subcommands and command helpers

After task-cmd extraction, add tests for extracted subcommand handlers and shared command helpers.

Coverage:
- happy-path test for each subcommand module
- helper tests for buildFieldsFromOptions and filter helper behavior
- key edge cases (missing key, invalid status, interactive + output format handling)

---

# Activity Log

## 2026-04-01T06:05:26.696Z

- **description**: added (6 lines)

## 2026-04-01T06:24:49.344Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-04-01T06:27:04.030Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-04-01T14:22:38.593Z

- **status**: NEEDS REVIEW → IN PROGRESS

## 2026-04-01T14:24:03.899Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-04-01T15:14:55.638Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
