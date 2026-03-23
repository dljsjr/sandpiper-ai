---
title: "Implement core execution flow"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-23T04:32:36.748Z
---

# Implement core execution flow

Implement the main execution sequence:

1. Confirm `prompt_ready` signal received (pane is at prompt)
2. Escape command via shell-appropriate mechanism
3. Construct wrapped command (` __relay_run 'ESCAPED_CMD'`)
4. Inject via Zellij `write-chars`
5. Read stdout and stderr from FIFOs as data arrives
6. Wait for `last_status:EXIT_CODE` on signal channel
7. Wait for `prompt_ready` on signal channel
8. Return structured result (stdout, stderr, exit code)

**Reference:** FR-3, FR-4, FR-8, FR-9

---

# Activity Log

## 2026-03-23T04:32:36.748Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
