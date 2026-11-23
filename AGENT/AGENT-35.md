---
title: "Design deferred deterministic guidance/enforcement hooks for tool use"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: "Piper"
reporter: USER
created_at: 2026-03-30T20:00:27.396Z
updated_at: 2026-11-23T22:02:52.529Z
---

# Design deferred deterministic guidance/enforcement hooks for tool use

Design the first deterministic tool-use enforcement slice for Sandpiper.

Canonical design docs:

- `.sandpiper/archive/agent-35-deterministic-tool-use-enforcement-prd-2026-06.md`
- `.sandpiper/archive/agent-35-deterministic-tool-use-enforcement-spec-2026-06.md`
- `.sandpiper/archive/agent-35-deterministic-tool-use-enforcement-work-plan-2026-06.md`

Current scope:

- Catalog-skill precondition enforcement only; no RG/Waymark clone.
- MVP uses Pi `tool_call` and a live loaded-skill registry from successful Sandpiper `skill` tool execution.
- MVP policies: direct `jj` via standard `bash` requires `jj`; inline task-store access requires `tasks` across structured file tools plus high-confidence simple bash inspection.
- `shell_relay`, PATH shims, Trail storage resolvers, repo-aware `git`, and `/skill:name` activation tracking are post-MVP.

Next implementation move: Phase 0 hook-surface spike from the work plan.

---

# Activity Log

## 2026-03-30T20:00:37.110Z

- **description**: added (1 line)

## 2026-03-31T15:39:16.634Z

- **priority**: MEDIUM → HIGH

## 2026-06-03T04:43:52.490Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → Huginn

## 2026-06-03T04:44:12.756Z

- **status**: IN PROGRESS → NOT STARTED
- **assignee**: Huginn → UNASSIGNED

## 2026-06-10T04:58:48.831Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → Piper

## 2026-06-10T14:14:13.992Z

- **description**: 1 line → updated (16 lines)

## 2026-07-01T03:02:42.477Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-07-11T16:53:29.535Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:02:52.529Z

- **description**: updated
