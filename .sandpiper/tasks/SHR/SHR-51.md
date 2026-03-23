---
title: "Env var exports visible in pane stdout on initial connect"
status: NOT STARTED
kind: BUG
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-23T05:35:02.369Z
updated_at: 2026-03-23T05:35:09.778Z
---

# Env var exports visible in pane stdout on initial connect

When Shell Relay connects to a pane, the FIFO path env var exports (set -gx / export commands) are injected via write-chars and appear as visible output above the first prompt. This is cosmetically noisy. Investigate whether Zellij has a mechanism to set environment variables in a pane without visible output (e.g., a flag on session/pane creation, or writing to the pane before it draws). Alternatively, could redirect write-chars output to suppress echo.

---

# Activity Log

## 2026-03-23T05:35:09.778Z

- **description**: added (1 line)
