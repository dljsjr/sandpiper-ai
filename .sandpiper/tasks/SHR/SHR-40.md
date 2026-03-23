---
title: "Session start hook"
status: COMPLETE
resolution: DONE
kind: TASK
priority: LOW
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-23T05:28:24.246Z
---

# Session start hook

On `session_start`, check relay readiness and notify the user.

**Acceptance criteria:**
- Check if Zellij is running
- Check if target pane is configured and reachable
- Detect `expect`/`tclsh` availability, report enhanced vs. basic mode
- Notify user of relay status via `ctx.ui.setStatus()` or `ctx.ui.notify()`

**References:** Work Plan Phase 4.2

---

# Activity Log

## 2026-03-23T05:27:31.658Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-23T05:28:24.246Z

- **status**: IN PROGRESS → COMPLETE
- **resolution**: DONE
