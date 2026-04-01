---
title: "Add /relay-cleanup command to remove stale EXITED relay sessions"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-03-28T05:04:42.259Z
updated_at: 2026-04-01T04:38:21.723Z
---

# Add /relay-cleanup command to remove stale EXITED relay sessions

Automatic cleanup of stale Zellij relay sessions is unsafe because other Sandpiper sessions (eligible for --resume) may have claimed those sessions via appendEntry, and we cannot cheaply enumerate all session files to know which relay sessions are 'orphaned'. Instead, add a /relay-cleanup command that lists all EXITED relay-* sessions and asks the user to confirm deletion. This gives the user full visibility and control without risking data loss.

---

# Activity Log

## 2026-03-31T15:39:16.677Z

- **priority**: MEDIUM → HIGH

## 2026-03-31T16:05:49.711Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-31T16:12:51.869Z

- **title**: Clean up stale Zellij sessions on startup and shutdown → Add /relay-cleanup command to remove stale EXITED relay sessions

## 2026-03-31T16:12:51.910Z

- **description**: added (1 line)

## 2026-03-31T16:21:38.309Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-04-01T04:38:21.723Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
