---
title: "Narrow updateAllReferences to use index instead of full file scan"
status: NOT STARTED
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-04-01T15:29:58.387Z
updated_at: 2026-04-01T15:31:15.480Z
---

# Narrow updateAllReferences to use index instead of full file scan

On a cross-project task move, `updateAllReferences` (move.ts:252) scans every .md file in every project directory to find files that reference the re-keyed tasks. For a small task system this is fine, but it scales linearly with total file count.

The index already tracks relationship fields (`dependsOn`, `blockedBy`, `related`) for each task. We could use these to identify exactly which tasks reference the moved keys, then only read and rewrite those files — typically O(references) instead of O(total tasks).

## What to do

1. Before scanning the filesystem, query the index for all tasks that have the moved task keys in their `dependsOn`, `blockedBy`, or `related` arrays.
2. Only open and rewrite those specific files.
3. Add a test that verifies reference updates work correctly on a larger fixture set and doesn't touch unrelated files.

## Note

This is a performance optimization, not a correctness issue. Low priority until task counts grow large enough to matter.

## References

- `packages/sandpiper-tasks-cli/src/core/move.ts:252` — updateAllReferences
- `.sandpiper/docs/code-review-tcl-v1.md` — Finding 3

---

# Activity Log

## 2026-04-01T15:31:15.480Z

- **description**: added (18 lines)
