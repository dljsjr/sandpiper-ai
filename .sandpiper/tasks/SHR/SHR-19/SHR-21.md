---
title: "Implement command serialization and locking"
status: NEEDS REVIEW
kind: SUBTASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-21T01:40:34-05:00
---

# Implement command serialization and locking

Ensure only one command executes at a time in the target pane. Concurrent tool calls must be queued and executed sequentially.

Use a mutex/lock pattern — when a command is in flight, subsequent calls wait for completion before proceeding.

**Reference:** FR-12
