---
title: "Session and pane lifecycle management"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-23T04:32:36.259Z
---

# Session and pane lifecycle management

Implement the three input configurations for connecting to or creating the shared terminal, plus environment variable export.

**Acceptance criteria:**
- Mode 1: No session/pane provided → create both, report identifiers to user
- Mode 2: Session provided, no pane → create pane in session, report pane ID
- Mode 3: Session + pane provided → connect to existing
- Export `SHELL_RELAY_SIGNAL`, `SHELL_RELAY_STDOUT`, `SHELL_RELAY_STDERR` into the pane
- Report identifiers via `ctx.ui.notify()` or tool result

**References:** FR-10, FR-9

---

# Activity Log

## 2026-03-23T04:32:36.259Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
