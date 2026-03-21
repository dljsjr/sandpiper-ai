---
title: "Register shell_relay tool"
status: NEEDS REVIEW
kind: SUBTASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-21T01:47:52-05:00
---

# Register shell_relay tool

Register the main `shell_relay` tool via `pi.registerTool()`:

- `name`: `shell_relay`
- `parameters`: `command` (string, required), `timeout` (number, optional)
- `promptSnippet`: one-line description for Available Tools section
- `promptGuidelines`: when to use shell_relay vs bash
- `execute`: delegates to relay orchestration module

**Reference:** FR-1
