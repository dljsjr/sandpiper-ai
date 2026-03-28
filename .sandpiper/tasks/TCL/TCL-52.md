---
title: "Add batch/filter support to task move command"
status: NOT STARTED
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-03-22T20:25:39.891Z
updated_at: 2026-03-29T00:37:46.887Z
---

# Add batch/filter support to task move command

Currently task move only accepts a single key. The original requirement specified filter-based batch operations (like update/pickup/complete). Deferred due to complexity: re-keying invalidates filter results mid-operation, reference updates compound, and counter allocation needs atomicity. Can be scripted via 'task list -f json' piped to a loop in the meantime.

---

# Activity Log

## 2026-03-22T20:25:46.417Z

- **description**: added (1 line)
