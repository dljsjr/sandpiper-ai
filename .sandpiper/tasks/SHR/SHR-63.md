---
title: "First command after setup often times out (prompt_ready race condition)"
status: COMPLETE
resolution: DONE
kind: BUG
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-03-25T03:02:39.233Z
updated_at: 2026-04-01T04:38:21.722Z
---

# First command after setup often times out (prompt_ready race condition)

The first shell_relay command after session setup frequently times out waiting for last_status, even though the command executes successfully in the pane. Subsequent commands work fine. The issue is likely a race condition: prompt_ready from the env export clear fires, the extension considers setup complete, injects the first command, but the signal parser hasn't fully drained or the FIFO listeners aren't ready to capture the command's signals. May need a small delay or an explicit readiness confirmation between setup completion and first command injection.

---

# Activity Log

## 2026-03-25T03:02:49.785Z

- **description**: added (1 line)

## 2026-03-31T17:15:48.510Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-31T17:17:15.733Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-04-01T04:38:21.722Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
