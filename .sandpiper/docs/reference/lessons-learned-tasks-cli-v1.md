# Lessons Learned — Tasks CLI v1 Implementation

Captured during the tasks CLI sprint (2026-03-21 through 2026-03-22).

## Design Process

### What worked well
- **Designing the Query API "blind"** (without knowledge of the index format) then using it to review and refactor the index structure. This surfaced the missing `project` field on indexed tasks and the need for a flat (not nested) index structure.
- **The spec as source of truth** — having the SPEC.md document made it easy to validate whether the CLI behavior was correct. Changes to behavior always went through the spec first.
- **User-story style tasks** with implementation details in subtasks gave clear acceptance criteria while keeping the backlog navigable.
- **Incremental feature addition** — building read-only commands first, then mutations, then move, then activity log, then history diffs. Each layer built on the previous one's foundation.

### What to improve
- **Refactoring should happen earlier and more frequently.** The `patterns.ts` extraction and the `taskFromFrontmatter` deduplication were overdue by the time we did them. The codebase had 5+ duplicated regex patterns and 2 identical fm→Task conversion blocks.
- **Don't use `require()` as a lazy import workaround.** We accumulated 15 dynamic `require()` calls trying to avoid circular dependencies or for "lazy loading." All of them were eventually replaced with static imports. Start with static imports and restructure modules if circular deps appear.

## Architecture Decisions

### Flat index structure
The original index was nested (`projects → tasks`). The Query API review revealed this was awkward — every query needed to flatten across projects. Refactored to flat `tasks: Record<string, IndexedTask>` with `project` as a field on each task. Much simpler.

### Counter state in the index, not meta files
Originally used per-project `.meta.yml` files for task numbering. Moved counters into the index to reduce file count. Added `scanHighestNumber` as fallback for index recovery. Tombstone `.moved` files prevent counter reuse after cross-project moves.

### Activity log + history diffs = complementary
- Activity log (in-file): quick summary of what changed — field transitions, line count deltas
- History diffs (external files): full unified diffs for audit trail
- Description changes: activity log shows `added (3 lines)` or `1 line → 5 lines`; history diff shows actual content

### Schema versioning from day one
Even though we only have version 1, the migration chain pattern is in place. Future schema changes will be incremental transforms that run automatically on load.

### Resolution field + no-deletion policy
Instead of deleting tasks, mark them `COMPLETE` with resolution `WONTFIX`. Tombstone files handle the moved-task case. The historical record is always preserved.

## Implementation Patterns

### CLI structure: thin commands, fat core
Commander command definitions are thin wiring — they parse args and delegate to `core/` modules. This lets us unit test core logic without spawning CLI processes. The `emitMutationResult` helper handles the cross-cutting concern of output formatting + index updates.

### `--format` and `--no-save` as root options
Making these global (not per-command) was the right call — every command benefits from structured output, and `--no-save` is a universal dry-run mechanism.

### `--interactive` editor mode
The `$EDITOR` tmpfile pattern (à la `git commit`) works well for task descriptions. Pre-applying flag-based changes before opening the editor lets users combine CLI flags with interactive editing.

### Move operations are complex
Cross-project moves involve: re-keying, subtask cascading, tombstone writing, counter allocation, inbound reference updates across all task files. The local counter tracking (allocate all keys before writing any files) was essential to avoid stale index reads.

## Linting Lessons

### Biome `--unsafe` is dangerous
The `--unsafe` auto-fix flag silently changes `!` to `?.`, which changes runtime semantics (returns `undefined` instead of throwing). This broke TypeScript type checking in multiple places. **Never use `--unsafe`.**

### Lint suppression requires user approval
We established a hard rule: the agent must not add `biome-ignore`, `@ts-ignore`, or similar suppression comments without consulting the user. This prevents suppression comment accumulation.

### Lint output must be zero-warning
Not "mostly clean" — zero. Every warning either gets fixed or explicitly suppressed (with user approval). This keeps the signal-to-noise ratio high.

## Testing Insights

### Test-to-source ratio > 1:1
The final codebase has ~3,400 lines of tests for ~3,300 lines of source. This ratio reflects the TDD approach — tests are written first, edge cases are first-class, and every feature has both unit and behavioral coverage.

### 178 tests across 15 files
The test suite covers: frontmatter parsing, query API (45 tests), index updates, mutations, consistency (index vs disk), counters, schema versioning, resolution validation, activity log, history diffs, search, move operations, output formatting, and CLI E2E.

### `bun compile` binaries need `.gitignore`
The compiled `sandpiper-tasks` binary is ~58MB. It needs a `.gitignore` entry to prevent jj from trying to snapshot it.

## Process Insights

### Keep tools simple
Resisted adding backlog/sprint/triage concepts. `NOT STARTED` + priority levels (`LOW`/`MEDIUM`/`HIGH`) are sufficient for small-team task management. The complexity of additional workflow states would exceed the problem they solve.

### The CLI replaced shell scripts entirely
The original 4 bash scripts (`task-create.sh`, `task-pick-up.sh`, `task-complete.sh`, `task-summary.sh`) were fully replaced by the CLI with significantly more capability: query/filter/search, structured output, dry-run, interactive editing, move operations, activity logging, and history tracking.
