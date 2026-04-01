---
title: "Spike: validate push/pull ergonomics for root()-based jj task workspace branch"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-04-01T17:51:21.489Z
updated_at: 2026-04-01T17:54:51.566Z
---

# Spike: validate push/pull ergonomics for root()-based jj task workspace branch

Validate whether a `jj workspace` rooted at `root()` can be backed by a bookmark that pushes and pulls cleanly against the real project remote.

## Goal

Answer the remaining open question in `.sandpiper/docs/task-storage-strategy.md` about whether root-based independent history should be the default for the jj backend.

## Questions to answer

1. Can we create a workspace on top of `root()` and attach a bookmark to its branch cleanly?
2. Can that bookmark be pushed to the remote without surprising jj or git behavior?
3. Can the branch be fetched/pulled back cleanly after local deletion / movement?
4. Are there any issues with unrelated history, bookmarks, or remote-tracking refs that would make this awkward in practice?
5. What exact bootstrap/push/pull/cleanup commands should the implementation use?

## Constraints

- Use this project repo and its real remote for the push/pull test
- Use only temporary spike bookmarks/workspaces and clean them up afterward

## Deliverable

- Findings folded into `.sandpiper/docs/task-storage-strategy.md`
- Recommendation on whether `root()` should be hard-coded for the jj backend

## References

- `.sandpiper/docs/task-storage-strategy.md`
- `dist/skills/sandpiper/jj/SKILL.md`

---

# Activity Log

## 2026-04-01T17:51:21.518Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-04-01T17:51:33.883Z

- **description**: added (28 lines)

## 2026-04-01T17:54:51.566Z

- **status**: IN PROGRESS → COMPLETE
- **resolution**: DONE
