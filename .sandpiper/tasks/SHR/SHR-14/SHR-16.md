---
title: "Implement pane content capture via dump-screen"
status: NEEDS REVIEW
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-21T01:27:43-05:00
---

# Implement pane content capture via dump-screen

Wrap `zellij action dump-screen --full` for capturing pane visual state.

- Support writing to a file path (including FIFO)
- Return captured content as a string
- Used by `shell_relay_inspect` tool (FR-6)

**Reference:** FR-6, FR-7
