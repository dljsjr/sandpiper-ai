---
title: "Implement timeout support with Ctrl+C injection"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-23T04:32:36.201Z
---

# Implement timeout support with Ctrl+C injection

Support an optional timeout parameter on command execution:

- If a command exceeds the timeout, inject Ctrl+C via `zellij action write-chars` (send `\x03`)
- Return a timeout error to the agent, including any stdout/stderr captured up to the timeout point
- Ensure FIFOs are left in a clean state after timeout

**Reference:** FR-13

---

# Activity Log

## 2026-03-23T04:32:36.201Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
