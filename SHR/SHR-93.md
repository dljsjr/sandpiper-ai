---
title: "Clean up EXITED relay sessions on startup"
status: COMPLETE
resolution: WONTFIX
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-03-31T14:18:18.299Z
updated_at: 2026-03-31T14:19:23.449Z
---

# Clean up EXITED relay sessions on startup

After a laptop reboot or Zellij restart, shell-relay sessions show up as EXITED in zellij ls. The extension currently creates a new session on demand without cleaning up the old EXITED ones. Over time these accumulate. Add a cleanup step (on session_start or on new relay session creation) that removes EXITED relay-* sessions, either by listing and deleting them or by integrating with the Zellij session lifecycle. Low priority since the accumulation is cosmetic and does not affect function.

---

# Activity Log

## 2026-03-31T14:18:18.340Z

- **description**: added (1 line)

## 2026-03-31T14:19:23.454Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: WONTFIX
