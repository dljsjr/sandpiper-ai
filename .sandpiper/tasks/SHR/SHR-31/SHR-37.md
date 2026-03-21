---
title: "Integration tests"
status: NOT STARTED
kind: SUBTASK
priority: HIGH
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-20T23:00:00Z
---

# Integration tests

End-to-end tests with a real Zellij session and fish shell:

- Signal channel receives `prompt_ready` on prompt draw
- Agent commands: stdout and stderr captured separately
- Agent commands: exit codes correct (with and without `unbuffer-relay`)
- Agent commands: colors preserved (with `unbuffer-relay`)
- User sees output in pane via `/dev/tty`
- FIFOs reused across multiple sequential commands
- Pane inspection via `dump-screen`
- Timeout and Ctrl+C injection
- Pane busy detection and notification
- Signal channel resilience (kill extension, verify no terminal pollution)
- Basic mode fallback (`SHELL_RELAY_NO_UNBUFFER=1`)
