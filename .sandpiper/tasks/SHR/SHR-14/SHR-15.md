---
title: "Implement command injection via write-chars"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-23T04:32:36.540Z
---

# Implement command injection via write-chars

Wrap `zellij action write-chars` for injecting commands into a target pane.

- Accept a command string and inject it with a trailing newline
- Support session targeting via `ZELLIJ_SESSION_NAME` env var
- Handle errors (Zellij not running, pane not found)

**Reference:** FR-7

---

# Activity Log

## 2026-03-23T04:32:36.540Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
