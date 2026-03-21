---
title: "Implement O_RDWR sentinel pattern"
status: NEEDS REVIEW
kind: SUBTASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-21T01:26:06-05:00
---

# Implement O_RDWR sentinel pattern

Open each FIFO with `O_RDWR` so the fd acts as both reader and self-sentinel:
- Prevents blocking on open (no need to wait for a writer)
- Prevents EOF when external writers (`tee`, prompt hook) close their handles
- Single fd per FIFO, held open for the session lifetime

Validate that this works correctly across macOS and Linux.

**Reference:** FR-4
