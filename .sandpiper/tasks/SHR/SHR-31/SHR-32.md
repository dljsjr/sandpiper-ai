---
title: "FIFO manager unit tests"
status: NEEDS REVIEW
kind: SUBTASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-21T01:26:06-05:00
---

# FIFO manager unit tests

Test the persistent FIFO manager with real FIFOs:

- FIFO creation with correct paths and permissions
- O_RDWR sentinel: verify no EOF between writes, continuous reading works
- Multiple sequential writes/reads (simulating multiple commands)
- Cleanup on shutdown
- Stale FIFO detection on startup
- Graceful handling of broken/deleted FIFOs
