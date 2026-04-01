---
title: "Implement FIFO cleanup and stale detection"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-23T04:32:36.229Z
---

# Implement FIFO cleanup and stale detection

- On shutdown: close all fds, remove FIFO files and session directory
- On startup: scan for stale FIFO directories from previous crashed sessions and clean them up
- Handle FIFO disconnection gracefully (broken pipe mid-session → re-create and re-open)

**Reference:** FR-4, NFR-3

---

# Activity Log

## 2026-03-23T04:32:36.230Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
