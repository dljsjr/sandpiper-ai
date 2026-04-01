---
title: "Phase 2: support separate-branch task storage in the current repo"
status: NOT STARTED
kind: TASK
priority: HIGH
assignee: UNASSIGNED
reporter: USER
created_at: 2026-04-01T18:01:57.031Z
updated_at: 2026-04-01T18:04:22.717Z
---

# Phase 2: support separate-branch task storage in the current repo

Implement Phase 2 from `.sandpiper/docs/task-storage-implementation-plan.md`.

## Goal

Support separate-branch task storage in the current repo with explicit bootstrap via `sandpiper tasks init`.

## Backend rule

- current repo has `.jj/` → use `jj workspace` rooted at `root()`
- current repo has `.git/` but not `.jj/` → use `git worktree`
- establish local bookmark/branch plus remote tracking during init

## Done when

- config resolution and precedence work
- explicit init works in both jj and plain git repos
- sync / auto-commit / auto-push behavior follows config
- inline-to-separate-branch migration works
- docs and integration tests cover the full current-repo flow

## References

- `.sandpiper/docs/task-storage-strategy.md`
- `.sandpiper/docs/task-storage-implementation-plan.md`

---

# Activity Log

## 2026-04-01T18:04:22.717Z

- **description**: added (24 lines)
