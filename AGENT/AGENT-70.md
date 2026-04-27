---
title: "Add stop/kill tool to background process tooling"
status: NOT STARTED
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-04-21T19:07:12.108Z
updated_at: 2026-06-03T04:44:12.554Z
---

# Add stop/kill tool to background process tooling

Current background process tooling (start_background_process, check_background_process) has no way to terminate a running process from the agent side. This means processes like long-running matrix evaluations or dev servers can only be killed externally (e.g., via shell commands like `kill`). A `stop_background_process` tool that cleanly terminates by ID would solve the inability to manage process lifetime within the agent harness.

---

# Activity Log

## 2026-04-21T19:07:16.076Z

- **description**: added (1 line)

## 2026-06-03T04:43:52.492Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → Huginn

## 2026-06-03T04:44:12.556Z

- **status**: IN PROGRESS → NOT STARTED
- **assignee**: Huginn → UNASSIGNED
