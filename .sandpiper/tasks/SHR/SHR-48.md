---
title: "Use FIFO for dump-screen output in shell_relay_inspect tool"
status: NOT STARTED
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-03-23T04:32:18.462Z
updated_at: 2026-03-23T04:32:18.501Z
---

# Use FIFO for dump-screen output in shell_relay_inspect tool

The shell_relay_inspect tool creates a temp file for dump-screen output, reads it, and deletes it. Since `zellij action dump-screen --full /path/to/fifo` was validated to work with FIFOs, we could use a FIFO instead to avoid filesystem writes.

This is a minor optimization — temp files work fine but FIFOs are cleaner.

Reference: code-review-shr-v1.md Finding 5

---

# Activity Log

## 2026-03-23T04:32:18.501Z

- **description**: added (5 lines)
