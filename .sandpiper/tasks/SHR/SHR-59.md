---
title: "Update README and /relay-connect for ghost client auto-create flow"
status: NOT STARTED
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-03-23T06:47:54.831Z
updated_at: 2026-03-23T06:48:02.637Z
---

# Update README and /relay-connect for ghost client auto-create flow

The README was written before the ghost client approach. It references manual session creation and SHELL_RELAY_SESSION env var. Now sessions auto-create via ghost client and user attachment is optional. Also /relay-connect's 'Create new session' option may be redundant since auto-create handles it. Update docs to reflect the new flow.

---

# Activity Log

## 2026-03-23T06:48:02.637Z

- **description**: added (1 line)
