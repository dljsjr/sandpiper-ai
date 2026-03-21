---
title: "Session start hook"
status: NOT STARTED
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-20T23:00:00Z
---

# Session start hook

On `session_start`, check relay readiness and notify the user.

**Acceptance criteria:**
- Check if Zellij is running
- Check if target pane is configured and reachable
- Detect `expect`/`tclsh` availability, report enhanced vs. basic mode
- Notify user of relay status via `ctx.ui.setStatus()` or `ctx.ui.notify()`

**References:** Work Plan Phase 4.2
