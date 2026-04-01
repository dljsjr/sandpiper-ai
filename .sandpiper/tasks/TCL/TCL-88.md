---
title: "Phase 3: support external-repo task storage"
status: NOT STARTED
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-04-01T18:01:57.062Z
updated_at: 2026-04-01T18:04:22.748Z
---

# Phase 3: support external-repo task storage

Implement Phase 3 from `.sandpiper/docs/task-storage-implementation-plan.md`.

## Goal

Support external-repo task storage via plain clone semantics.

## Backend rule

- current repo is jj-managed → clone external repo with `jj git clone --colocate`
- current repo is plain git → clone external repo with `git clone`
- do not use workspaces/worktrees for external repos

## Done when

- explicit init bootstraps external-repo mode cleanly
- branch selection / creation / tracking works
- sync flows and repair guidance exist
- integration tests cover expected external-repo workflows

## References

- `.sandpiper/docs/task-storage-strategy.md`
- `.sandpiper/docs/task-storage-implementation-plan.md`

---

# Activity Log

## 2026-04-01T18:04:22.749Z

- **description**: added (23 lines)
