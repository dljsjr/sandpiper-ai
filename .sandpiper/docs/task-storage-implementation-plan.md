# Task Storage Strategy — Implementation Plan

**Status:** Planned  
**Planning ticket:** TCL-85  
**Design reference:** `.sandpiper/docs/task-storage-strategy.md`  
**Date:** 2026-04-01  

## Purpose

Translate the approved task storage strategy design into concrete implementation phases and handoff-ready tickets.

This document is execution-oriented. It does **not** restate the full rationale or design trade-offs from the strategy doc; it assumes that document is the source of truth for:

- why task storage needs to reduce VCS churn
- the config model (`version_control`, `mode.branch`, `mode.repo`, `auto_commit`, `auto_push`)
- the backend selection rule (jj repo → `jj workspace`, git repo → `git worktree`, external repo → plain clone)
- the decision to treat `index.toon` as derived state
- the decision to retain history files

## Delivery structure

Implementation is split into four top-level phases:

| Phase | Ticket | Priority | Goal |
|------|--------|----------|------|
| 1 | TCL-86 | HIGH | Make the index derived state and remove the biggest churn source without changing storage topology |
| 2 | TCL-87 | HIGH | Support separate-branch task storage in the current repo |
| 3 | TCL-88 | MEDIUM | Support external-repo task storage |
| 4 | TCL-89 | LOW | Generalize the storage bootstrap for future domains and unified init |

Each phase has child subtasks that can be handed to a contributor independently.

## Recommended sequencing

1. **Phase 1 first** — independent, high-value cleanup that reduces churn immediately and simplifies later phases.
2. **Phase 2 next** — the core feature for current-repo separate-branch storage.
3. **Phase 3 after Phase 2** — external-repo support builds on the same config and sync abstractions.
4. **Phase 4 last** — explicitly future-facing; do not let it block practical task-storage improvements.

## Cross-phase invariants

These rules apply to every implementation ticket in this plan:

- Preserve the current on-disk task file model and history diff files.
- Preserve backward compatibility for existing inline-storage users until migration is explicit.
- Prefer explicit operator actions over silent bootstrap for separate-branch or external-repo modes.
- Keep the current repo's code history and task history independent when using separate-branch or external-repo modes.
- Use the task CLI and the design doc as sources of truth; do not invent alternate storage semantics in code.
- Add integration tests for each storage mode once the relevant phase lands.

## Phase 1 — Derived index / scan-first counters

**Top-level ticket:** TCL-86  
**Theme:** Reduce churn immediately with minimal topology changes.

### Goal

Treat `index.toon` as derived state, not source of truth:

- gitignore it
- rebuild it when missing or stale
- make scan-from-disk the primary counter allocation path

### Why this phase matters

This phase is valuable even if we stop before Phase 2. It removes the single noisiest file from task operations and makes future storage modes easier because the implementation no longer relies on a committed index.

### Subtasks

| Ticket | Priority | Scope |
|--------|----------|-------|
| TCL-90 | HIGH | Gitignore `index.toon` and rebuild when missing/stale |
| TCL-91 | HIGH | Make scan-from-disk the primary counter allocation path |
| TCL-92 | MEDIUM | Add tests/docs for no-index startup, rebuild, and counter flows |

### Acceptance criteria

- `index.toon` is ignored by VCS in all storage modes.
- CLI commands behave correctly when the index does not exist yet.
- CLI commands rebuild the index automatically when it is stale.
- Counter allocation remains monotonic and respects `.moved` tombstones.
- Existing tests are updated and new tests cover missing/stale index startup.

### Risks / edge cases

- Startup latency if the index rebuild happens too often.
- Counter regressions if a code path still trusts the stale index over disk scan.

## Phase 2 — Separate-branch support in current repo

**Top-level ticket:** TCL-87  
**Theme:** Current repo can store tasks on a dedicated branch at `.sandpiper/tasks/`.

### Goal

Support explicit `sandpiper tasks init` bootstrap for current-repo separate-branch storage with backend-specific mechanics:

- jj repo → `jj workspace` rooted at `root()`
- plain git repo → `git worktree`

### Subtasks

| Ticket | Priority | Scope |
|--------|----------|-------|
| TCL-93 | HIGH | Implement task storage config resolution and precedence |
| TCL-94 | HIGH | Implement `sandpiper tasks init` for current-repo jj/git backends |
| TCL-95 | MEDIUM | Implement current-repo sync and auto-commit/auto-push behavior |
| TCL-96 | MEDIUM | Implement inline-to-separate-branch migration for current-repo mode |
| TCL-97 | MEDIUM | Add integration tests and operator docs for current-repo storage modes |

### Required behavior

- Config resolution precedence:
  1. `.sandpiper-tasks.json` at repo root
  2. `.sandpiper/settings.json` → `tasks`
  3. defaults
- Separate-branch mode must not silently bootstrap on ordinary task commands.
- `sandpiper tasks init` must be idempotent.
- jj backend must use a root-based independent workspace and create the local bookmark plus remote tracking setup.
- git backend must use `git worktree` and establish branch tracking.
- Inline mode (`branch: "@"`) remains current behavior.

### Acceptance criteria

- A jj repo can initialize `.sandpiper/tasks/` via nested `jj workspace` with independent history.
- A plain git repo can initialize `.sandpiper/tasks/` via `git worktree`.
- Remote tracking is established during init, even when `auto_push` is disabled.
- Task mutations behave correctly with `auto_commit=false` and `auto_commit=true`.
- `sandpiper tasks sync`, `push`, and `pull` work for the current-repo separate-branch model.
- Existing inline users are not broken; migration is explicit.

### Risks / edge cases

- Nested-workspace path assumptions in code or tests.
- Bookmark/worktree repair after partial bootstrap failures.
- Migration correctness when moving existing inline tasks/history into the separate branch.

## Phase 3 — External repo support

**Top-level ticket:** TCL-88  
**Theme:** Store tasks in a separate repository while preserving the same config semantics.

### Goal

Support `mode.repo` by cloning an external task repo into `.sandpiper/tasks/` and using the configured branch there.

### Backend rule

- current repo is jj-managed → clone with `jj git clone --colocate`
- current repo is plain git → clone with `git clone`

### Subtasks

| Ticket | Priority | Scope |
|--------|----------|-------|
| TCL-98 | MEDIUM | Implement external repo bootstrap with jj/git clone semantics |
| TCL-99 | MEDIUM | Implement branch selection/tracking and sync flows for external repo mode |
| TCL-100 | MEDIUM | Add integration tests and conflict/repair guidance for external repo mode |

### Acceptance criteria

- `sandpiper tasks init` can bootstrap external-repo mode cleanly.
- `branch: "@"` uses the cloned remote's default branch (`HEAD`).
- Named-branch mode creates or checks out the correct branch.
- Remote tracking is set up during init.
- Sync flows handle pull-before-push correctly.
- Operator guidance exists for repair after a broken clone, missing remote branch, or divergence.

### Risks / edge cases

- Different authentication/config semantics between `jj git clone --colocate` and `git clone`.
- Repair behavior when `.sandpiper/tasks/` already exists but points at the wrong remote.
- Conflict flows after local-only task edits in the cloned repo.

## Phase 4 — Future-domain generalization

**Top-level ticket:** TCL-89  
**Theme:** Make the storage/bootstrap machinery reusable for PKM/MEM and expose a unified operator surface.

### Goal

Refactor the tasks-first implementation into a reusable storage/bootstrap system without blocking the immediate task-storage work.

### Subtasks

| Ticket | Priority | Scope |
|--------|----------|-------|
| TCL-101 | LOW | Extract reusable storage bootstrap primitives for future domains |
| TCL-102 | LOW | Implement unified init/status surfaces for configured storage domains |
| TCL-103 | LOW | Document PKM/MEM adoption path for generalized storage bootstrap |

### Acceptance criteria

- The storage bootstrap code is no longer task-specific where it does not need to be.
- A future PKM or MEM implementation can reuse the same bootstrap/config/sync primitives.
- There is a coherent operator entry point for viewing and initializing configured storage domains.

### Non-goal

Do **not** let this phase block Phase 1–3. It is intentionally future-facing.

## Handoff notes

A contributor picking up any phase should read, in order:

1. `.sandpiper/docs/task-storage-strategy.md`
2. This implementation plan
3. The relevant top-level phase ticket and its subtasks

### Expected implementation style

- Use existing task CLI conventions and update tests first when behavior changes.
- Prefer explicit init/migrate/sync commands over hidden magic.
- Keep the main repo's working copy clean in separate-branch and external-repo modes.
- Document operational commands clearly; this feature is as much workflow design as code.

## Ticket map

### Planning
- **TCL-85** — Work plan: decompose task storage strategy implementation into phased tickets

### Phase 1
- **TCL-86** — Phase 1: treat `index.toon` as derived state and make disk scan primary for counter allocation
  - **TCL-90** — Gitignore `index.toon` and rebuild it when missing or stale
  - **TCL-91** — Make scan-from-disk the primary counter allocation path
  - **TCL-92** — Add coverage and docs for no-index startup/rebuild/counter flows

### Phase 2
- **TCL-87** — Phase 2: support separate-branch task storage in the current repo
  - **TCL-93** — Implement task storage config resolution and precedence
  - **TCL-94** — Implement `sandpiper tasks init` for current-repo jj/git backends
  - **TCL-95** — Implement current-repo sync and auto-commit/auto-push behavior
  - **TCL-96** — Implement inline-to-separate-branch migration for current-repo mode
  - **TCL-97** — Add integration tests and operator docs for current-repo storage modes

### Phase 3
- **TCL-88** — Phase 3: support external-repo task storage
  - **TCL-98** — Implement external repo bootstrap with jj/git clone semantics
  - **TCL-99** — Implement branch selection/tracking and sync flows for external repo mode
  - **TCL-100** — Add integration tests and conflict/repair guidance for external repo mode

### Phase 4
- **TCL-89** — Phase 4: generalize storage bootstrap for future domains and unified init
  - **TCL-101** — Extract reusable storage bootstrap primitives for future domains
  - **TCL-102** — Implement unified init/status surfaces for configured storage domains
  - **TCL-103** — Document PKM/MEM adoption path for generalized storage bootstrap
