---
title: "Register shell_relay tool"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-23T04:32:36.575Z
---

# Register shell_relay tool

Register the main `shell_relay` tool via `pi.registerTool()`:

- `name`: `shell_relay`
- `parameters`: `command` (string, required), `timeout` (number, optional)
- `promptSnippet`: one-line description for Available Tools section
- `promptGuidelines`: when to use shell_relay vs bash
- `execute`: delegates to relay orchestration module

**Reference:** FR-1

---

# Activity Log

## 2026-03-23T04:32:36.575Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
