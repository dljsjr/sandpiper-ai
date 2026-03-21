---
title: "Register shell_relay_inspect tool"
status: NEEDS REVIEW
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-21T01:47:52-05:00
---

# Register shell_relay_inspect tool

Register the `shell_relay_inspect` tool for pane visual inspection:

- Wraps `zellij action dump-screen --full`
- Returns the current visual state of the target pane as text
- Used by the agent to observe user-initiated activity or inspect pane state

**Reference:** FR-6
