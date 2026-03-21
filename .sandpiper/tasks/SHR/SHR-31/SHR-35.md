---
title: "Zellij integration mock tests"
status: NEEDS REVIEW
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-21T01:27:43-05:00
---

# Zellij integration mock tests

Test the Zellij CLI wrapper with mocked subprocess calls:

- `write-chars` constructs correct CLI invocation
- `dump-screen --full` with file path argument
- `attach --create-background` for session creation
- `action new-pane` for pane creation
- `ZELLIJ_SESSION_NAME` is set correctly for session targeting
- Error handling: Zellij not installed, not running, pane not found
