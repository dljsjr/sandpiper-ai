---
title: "Zellij CLI integration"
status: NEEDS REVIEW
kind: TASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-21T01:27:43-05:00
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
