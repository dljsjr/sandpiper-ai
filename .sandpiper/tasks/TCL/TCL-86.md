---
title: "Phase 1: treat index.toon as derived state and make disk scan primary for counter allocation"
status: IN PROGRESS
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-04-01T18:01:56.999Z
updated_at: 2026-04-01T18:18:02.359Z
---

# Phase 1: treat index.toon as derived state and make disk scan primary for counter allocation

Implement Phase 1 from `.sandpiper/docs/task-storage-implementation-plan.md`.

## Goal

Treat `index.toon` as derived state rather than a committed source of truth, and make scan-from-disk the primary counter allocation path.

## Scope

This phase should deliver immediate churn reduction without changing storage topology. It is explicitly designed to be valuable even if the later branch/repo storage phases are delayed.

## Done when

- `index.toon` is no longer expected to be committed
- commands rebuild the index automatically when missing or stale
- task-number allocation is driven primarily by disk scan + tombstones, not the cached index
- all related tests and operator docs are updated

## References

- `.sandpiper/docs/task-storage-strategy.md`
- `.sandpiper/docs/task-storage-implementation-plan.md`

---

# Activity Log

## 2026-04-01T18:04:22.685Z

- **description**: added (21 lines)

## 2026-04-01T18:18:02.360Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT
