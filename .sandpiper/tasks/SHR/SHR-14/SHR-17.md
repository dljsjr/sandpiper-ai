---
title: "Implement session and pane creation"
status: NEEDS REVIEW
kind: SUBTASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-21T01:27:43-05:00
---

# Implement session and pane creation

Implement the three input configurations from FR-10:

1. `zellij attach --create-background <name>` — create a new detached session
2. `ZELLIJ_SESSION_NAME=<session> zellij action new-pane` — create pane in existing session
3. Connect to existing session + pane — just set `ZELLIJ_SESSION_NAME`

Return session and pane identifiers for reporting to the user.

**Reference:** FR-10
