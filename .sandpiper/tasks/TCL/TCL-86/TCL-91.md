---
title: "Make scan-from-disk the primary counter allocation path"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-04-01T18:02:14.995Z
updated_at: 2026-04-01T18:30:09.366Z
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

## 2026-04-01T18:18:02.455Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-04-01T18:29:50.811Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-04-01T18:30:09.366Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
