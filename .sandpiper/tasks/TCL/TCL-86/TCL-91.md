---
title: "Make scan-from-disk the primary counter allocation path"
status: NOT STARTED
kind: SUBTASK
priority: HIGH
assignee: UNASSIGNED
reporter: USER
created_at: 2026-04-01T18:02:14.995Z
updated_at: 2026-04-01T18:04:22.851Z
---

# Make scan-from-disk the primary counter allocation path

Phase 1 subtask.

Make scan-from-disk the primary task-number allocation path, with `.moved` tombstones preserving non-reuse semantics.

## Done when

- task creation does not rely on committed/stored index state for correctness
- the highest allocated number is determined from disk/tombstones first
- counter behavior remains monotonic under rebuild scenarios

## Parent

- TCL-86

---

# Activity Log

## 2026-04-01T18:04:22.851Z

- **description**: added (13 lines)
