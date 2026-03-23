---
title: "Zellij CLI integration"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-23T04:32:36.369Z
---

# Zellij CLI integration

Implement the Zellij CLI wrapper (`zellij.ts`) that provides all multiplexer operations needed by the relay.

**Acceptance criteria:**
- Command injection via `write-chars`
- Pane content capture via `dump-screen --full` (to FIFO or file)
- Session creation via `attach --create-background`
- Pane creation via `action new-pane`
- Session targeting via `ZELLIJ_SESSION_NAME` environment variable
- Pane process state queries via `list-clients` or equivalent
- Availability detection (is Zellij installed and running?)
- Framework-independent: no pi imports

**References:** FR-7

---

# Activity Log

## 2026-03-23T04:32:36.369Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
