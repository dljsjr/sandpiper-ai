# Future mutation preview gate design

Mode: Reference design for Rust port or future `--dry-run` feature.

Task: TCL-138, finding 3 follow-up (archived).

Date: 2026-06-12

Status: Not cutting. `--no-save` deleted instead. This document is reference for when the Rust port or a deliberate `--dry-run` feature needs a preview boundary.

## Problem

`--no-save` (preview) is a cross-cutting concern that permeates six command modules. Each independently checks `shouldSave(cmd)` and branches into write vs preview, with four different preview output shapes for the same conceptual operation. The flag has viral coupling: every new command that writes must remember to check it, and the preview shape diverges further with each addition. `task update -i` already forgot to check it once — that was a bug, not a style issue.

The root cause: **the write-vs-preview decision is made at the command layer, but the knowledge of what to write vs what to preview lives at the mutation layer.** Commands own both concerns; they shouldn't own either.

## Invariant

**Architectural invariant:** task mutations route through one persist/preview gate. Commands describe mutation intent; the gate decides whether to persist or preview. The flag touches one place.

**Enforcement strategy:** after migration, command modules do not import low-level write helpers (`writeTaskFileAuditably`, `updateIndex`, `writeFileAtomic`) or core mutators directly. They import plan builders + gate. A structural grep/fitness check verifies no command bypasses the boundary.

The enforcement layer is what makes the architectural invariant true, not the phrasing. Without import restriction, a command can still go around the gate.

## Abstraction

```ts
type MutationPlan = {
  affected: readonly PlannedTaskWrite[];
  message: string;
};

type PlannedTaskWrite = {
  path: string;
  originalContent?: string;
  newContent: string;
  changes: readonly FieldChange[];
  historyKey?: string;
};
```

Core computes a **plan**. The gate decides persist vs preview:

- **Persist:** write task files, update index, write history, auto-commit.
- **Preview:** render the plan (field changes, affected paths) without writing.

Commands parse CLI intent and call plan builders in core. Core computes `MutationPlan`. Commands do not own preview rendering or mutation knowledge. The gate owns rendering for preview mode and execution for persist mode.

`PlannedTaskWrite` is what `writeTaskFileAuditably` already takes, formalized as a data type. This is an extraction of an existing shape, not a new abstraction.

## Non-goals

- **Not making `--no-save` a literal no-disk-write mode.** Index/gitignore lazy-init writes from `loadTasks()` are a separate storage concern. The gate governs task mutation writes, not all disk I/O.
- **Not preserving current preview output shapes.** Current divergence (raw content, formatted fields, dry-run string, filtered task list) is evidence of missing architecture, not sacred behavior. The plan-based preview will be more uniform. That's an improvement.
- **Not porting `--no-save` to commands that don't currently support it.** Project commands and storage commands are outside the gate's contract.

## Characterization of current preview outputs

Before migration, characterize what each command does in preview mode so we know what we're deliberately changing:

| Command | Current preview behavior | Plan-based preview (target) |
|---|---|---|
| `task create` | Render task content/JSON/toon | PlannedTaskWrite field changes + new content |
| `task update` (non-interactive) | Apply field updates, render result | PlannedTaskWrite field changes + new content |
| `task update -i` | **Rejected** — cannot preview interactive edit | Unchanged (still rejected) |
| `task pickup` | Apply field updates, render result | PlannedTaskWrite field changes + new content |
| `task complete` | Apply field updates, render result | PlannedTaskWrite field changes + new content |
| `task move` | Print "Dry run" string | PlannedTaskWrite field changes + rekey map |
| `task archive` | Filter and list tasks that would archive | PlannedTaskWrite field changes + affected list |

The key divergence: `task move` and `task archive` have the weakest previews. Move just says "dry run." Archive lists tasks. Both can be improved to show the same planned-write shape as the others.

## Sequence

### Slice 0: Design note (this document)

Problem, invariant, abstraction, non-goals, characterization. Ratify before cutting.

### Slice 1: Non-interactive existing-task field mutations

**Scope:** `task update`, `task pickup`, `task complete`.

**Why first:** Same shape — resolve existing paths, compute field changes, preview or persist. Proves the boundary without wrestling create counters, move rekeys, or archive traversal.

**Steps:**
1. Define `MutationPlan` / `PlannedTaskWrite` types in core.
2. Extract plan-building logic from each command's write path.
3. Implement `executeOrPreview(cmd, plan)` gate.
4. Route the three commands through the gate.
5. Remove `shouldSave` checks from the three commands.
6. Verify: 381+ green, no behavior change for persist mode, preview output is plan-based.

### Slice 2: Create

**Scope:** `task create`.

**Harder because:** persist allocates counters/keys; preview must not reserve a key unless we're explicit about that. The plan for create includes a provisional key that may differ from the persisted key. Don't hide that complexity — the plan shape for create may need an optional `allocatedKey` field that's only present after persist.

### Slice 3: Archive and move

**Scope:** `task archive`, `task move`.

**Move last because:** rekey maps, tombstones, reference rewrites, history identity. That's the swamp edge. Move already has the most complex write path; it's where `writeTaskFileAuditably` was hardest to route. Archive is simpler but still involves path traversal.

### Slice 4: Excision and enforcement

**After all slices prove the shape:**
1. Remove remaining scattered `shouldSave()` checks from command modules.
2. Move write helpers behind the gate boundary (private exports or re-exports through the gate module).
3. Add structural grep check: `grep -rn 'shouldSave\|writeTaskFileAuditably\|updateIndex\|writeFileAtomic' packages/trail/src/commands/` should return zero hits from command modules (only from the gate module).
4. Consider making the check part of CI or a test.

## What this unlocks for the Rust port

The Rust port needs exactly one decision point for persist vs preview. The op-log model makes this natural: ops are the plan, the executor decides whether to apply or inspect. The TypeScript mutation gate is the same shape, just on the state-file side. Cutting it now means the port inherits a clean boundary instead of six scattered checks.

## Resolved design questions

- **`historyKey` lives on `PlannedTaskWrite`** (or nested under an `audit` field). Per-task-write, not global plan metadata. Move proved this: old-key history applies to the moved task write, not every write in the plan.
- **Preview rendering supports structured output (`json`/`toon`) behind `--format`, plus a human default.** Do not use `raw` as the universal dry-run shape; raw makes sense for one rendered file, not a multi-write plan with rekeys/reference rewrites.
- **The gate owns auto-commit on persist.** If the gate owns task writes/index/history, auto-commit is part of that persist boundary. Current: `emitMutationResult()` calls `autoCommitIfEnabled` — same smell, one helper deeper. Commands should not know about auto-commit.
