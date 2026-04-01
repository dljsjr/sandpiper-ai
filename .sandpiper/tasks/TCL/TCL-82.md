---
title: "Design doc: task storage strategy for reducing VCS churn"
status: IN PROGRESS
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-04-01T17:25:31.265Z
updated_at: 2026-04-01T17:27:19.198Z
---

# Design doc: task storage strategy for reducing VCS churn

Design the task storage strategy for reducing VCS churn from task operations.

The design doc is at `.sandpiper/docs/task-storage-strategy.md`.

## Summary

A configurable storage model with three axes:
- `enabled` — whether tasks are VCS-tracked at all
- `mode.branch` — which branch to store tasks on (`@` = inline, any other name = separate branch with worktree)
- `mode.repo` — optional external repo URL (defaults to current repo)

Combined with treating `index.toon` as derived state (gitignored, auto-rebuilt).

## Acceptance criteria

- Design doc reviewed and approved
- Open questions resolved (especially jj workspace/worktree spike)
- Implementation tickets created for Phase 1 through Phase 3

---

# Activity Log

## 2026-04-01T17:25:35.004Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-04-01T17:27:19.198Z

- **description**: added (18 lines)
