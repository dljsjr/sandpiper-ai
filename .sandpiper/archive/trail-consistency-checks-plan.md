# Trail: mutation-time consistency checks

Status: reviewed and converged (Huginn, Muninn) — ready for implementation pending Doug's go-ahead
Related: TCL-138 (Trail health audit — confirmed unrelated layer, see "Relationship to TCL-138" below)

## Motivation

Doug's `~/.local/bin/task-board` script (a glimpse-powered Trail kanban board, external
to this repo) independently reimplements two consistency checks in client-side JS, purely
for passive display:

1. Active child task under a COMPLETE parent.
2. A task in NEEDS REVIEW or COMPLETE with an unresolved blocker (`blockedBy` task not
   itself COMPLETE + resolution DONE).

These checks don't exist in Trail itself today. Trail's own `core/consistency.ts` checks a
completely different thing (index-vs-disk staleness, not task-relationship validity).

Doug wants these — and a few more found during a code-model survey — moved into Trail
itself, enforced **at the moment of the mutating operation**, the same way `completeTask`
already hard-blocks finalizing with resolution DONE unless the task is currently NEEDS
REVIEW (`core/mutate.ts:591`). Not a separate query/report command; a gate on the write
path itself.

## Scope: four checks

| # | Check | New or already-brainstormed |
|---|---|---|
| 1 | Parent/child status consistency (bidirectional) | From task-board, extended |
| 2 | Blocker-resolution consistency | From task-board |
| 3 | Dangling relationship references (`blockedBy`/`dependsOn`/`related` pointing at a nonexistent key) | New, found during this session's survey |
| 4 | Cycle detection on `blockedBy`/`dependsOn` (self-reference is the degenerate case) | New, found during this session's survey |

Explicitly out of scope for this pass (surfaced during brainstorming, deferred as judgment
calls rather than clear-cut violations): stale `resolution` on reopen, archived-but-still-
referenced blockers, cross-project parent/child drift, assignee/status pairing smells,
duplicate-key detection from direct file edits.

## WONTFIX exemption (decided after implementation)

Check 2 (blocker resolution) does not apply when the resulting resolution is WONTFIX --
mirroring how the existing NEEDS-REVIEW-before-DONE rule already treats WONTFIX as an
abandon-from-anywhere path. If you're abandoning a task, its blockers' state doesn't
matter. DONE still requires all blockers COMPLETE + DONE, no exemption.

Check 1a (children-complete-before-finalize) does **not** get the same exemption, and
this was a deliberate, considered call, not an oversight: check 1b (the other direction
of the parent/child rule) only looks at the parent's *status*, not its resolution -- so
exempting WONTFIX from check 1a would let a parent go COMPLETE while children stay
active, which check 1b would then treat as a violation the next time someone explicitly
sets status on one of those children (not proactively or immediately -- like every other
guard here, check 1b is write-time-only, not a corpus-wide sweep). The two checks aren't
symmetric in what a WONTFIX exemption would cost, even though they look structurally
similar.

## Enforcement semantics

- **Hard error by default**, matching the existing NEEDS-REVIEW-before-DONE precedent's
  posture (not its exact mechanism — see below).
- **A demote-to-warning flag** on the mutating CLI commands (working name: `--force`,
  open to a better name) that, when passed, prints the violation instead of blocking.
- **The existing NEEDS-REVIEW-before-DONE rule is untouched** — stays an unconditional hard
  block, no flag, exactly as it is today. Doug was explicit about this.

## Where each check fires

| Check | Triggering operation(s) |
|---|---|
| 1. Parent/child status | `completeTask` (finalizing a parent with non-COMPLETE children); `updateTaskFields` (setting a child's status away from COMPLETE while its parent is COMPLETE); `createTask` (creating a new SUBTASK under an already-COMPLETE parent); `moveTask` (re-parenting a task under a COMPLETE parent) |
| 2. Blocker resolution | `completeTask` (moving to NEEDS REVIEW or COMPLETE while a `blockedBy` entry isn't COMPLETE+DONE) — same call site as the existing NEEDS-REVIEW rule; `updateTaskFields` (adding a new `blockedBy` entry to a task that's already NEEDS REVIEW/COMPLETE) |
| 3. Dangling references | `createTask` and `updateTaskFields`, whenever `blockedBy`/`dependsOn`/`related` is being set — validate each key resolves to an existing task file, same treatment `parent` already gets |
| 4. Cycles | `createTask` and `updateTaskFields`, whenever `blockedBy`/`dependsOn` is being set — walk the graph from the affected task through the *proposed* new edge to check for a path back to itself |

## Data access at the mutate.ts layer — resolved: targeted lookups, no signature widening

First draft framed this as a binary — thread the whole `allTasks: readonly Task[]` into
`mutate.ts`'s functions (matching how `completeTask`'s existing NEEDS-REVIEW check reads
fresh state) versus pre-checking at the command layer where `loadTasks()` already has the
full graph. Both options turned out to be a false choice; Huginn found the actual answer
by checking what `move.ts` already does, and it's neither.

None of the four checks actually need the *whole* task list materialized:

- **Check 1, parent finalizing with non-COMPLETE children** — needs the parent's own
  subtasks. `move.ts` already has `collectSubtasks(tasksDir, parentKey, project)`, a
  `readdirSync` on the subtask directory. No `Task[]` needed.
- **Check 1, child leaving COMPLETE under a COMPLETE parent** — needs one lookup: this
  task's own parent, resolved from its path. `move.ts`'s `resolveParentFromPath` already
  does this; one file read for the parent's current status finishes it.
- **Check 1, re-parenting via `moveTask`** — `moveTask` already reads the target parent to
  validate it (`validateParentIsTopLevel`). Adding a status check is zero new access.
- **Check 2, blocker resolution** — N single lookups on the specific keys in `blockedBy`,
  not the whole set.
- **Check 3, dangling references** — N existence checks via `resolveTaskFile(tasksDir, key)`
  (`patterns.ts`), which already throws when a key doesn't resolve to a file — exactly the
  existence check needed, just wrapped in try/catch instead of read as a boolean.
- **Check 4, cycles** — a traversal, not a materialization: BFS from the affected task
  along `blockedBy`/`dependsOn` edges, one file read per hop via `resolveTaskFile`, not a
  full graph loaded upfront.

This also resolves the bulk-mutation staleness Muninn found (see below) as a side effect
rather than needing a dedicated fix: `task-update.ts`/`task-pickup.ts`/`task-complete.ts`
all load `allTasks` once before their bulk loop, so *any* check validated against that
snapshot goes stale mid-batch (bulk-completing a parent and its children together would
check each one against pre-loop state). Targeted per-call disk reads sidestep this for
free — each lookup reads current state at call time, not a pre-loaded snapshot.

`mutate.ts:591`'s existing NEEDS-REVIEW check turned out to be better precedent for this
than the first draft gave it credit for: it re-reads its *own single file* fresh from disk
inside the function — it never touches the graph at all. That's precedent for "read fresh
state for whatever specific other files you need, via existing helpers," not for "thread a
whole pre-loaded snapshot in." Going with targeted lookups matches that precedent more
faithfully than either original option did.

**One additional write site found during this review, not in the original trigger-point
table:** `move.ts`'s `updateReferencesInFile` (fired inside `moveTask` on cross-project
rekeys) also rewrites `blockedBy`/`dependsOn`/`related` — via blind regex substitution,
zero validation. It's a rename, not a new relationship, so it shouldn't introduce fresh
dangling references if the rekey map is correct — but worth being an explicit, deliberate
non-issue rather than a silent gap.

**`task update --interactive` closed, not left as scope.** Originally flagged as a gap:
the `$EDITOR` path wrote via `writeTaskFileAuditably` directly, bypassing all 4 guards
entirely, since it lets a user freely edit anything. Turned out straightforward to close:
parse both the pre-edit and post-edit content, diff just the four guard-relevant fields
(status/blockedBy/dependsOn/related — `diffGuardRelevantFields` in
`task-cmd-helpers.ts`), and feed that diff into the same `enforceUpdateFieldGuards` every
other path uses. No new guard logic needed; the existing design (guards as pure functions
over a proposed-fields diff, not tied to how the diff was produced) generalized cleanly to
a call shape it wasn't originally scoped for. Verified end-to-end with a scripted `$EDITOR`
against a real CLI invocation: blocks a violation, `--force` warns and proceeds, an edit
that resolves the violation succeeds silently, and an unrelated edit (touching neither
field) is untouched by the guards.

**Wiring detail that must be resolved before implementation (Muninn, verified):**
`collectSubtasks` and `resolveParentFromPath` are private to `move.ts` today. Check 1's
parent-finalizing case needs `collectSubtasks` from `completeTask`, which lives in
`mutate.ts`. But `move.ts` already imports `applyInternalFieldUpdates`/
`writeTaskFileAuditably` from `mutate.ts` (`move.ts:8`) — so `mutate.ts` importing
`collectSubtasks` from `move.ts` would create a real `mutate.ts` ↔ `move.ts` circular
import, not a hypothetical one. Fix: relocate `collectSubtasks` and `resolveParentFromPath`
to `patterns.ts` — confirmed a true leaf module (only `node:fs`/`node:path`), already the
home of `resolveTaskFile`, already imported by both `move.ts` and `mutate.ts`. Export both
from there; `move.ts` imports them back the same way it already imports `resolveTaskFile`.
No cycle, no new coupling.

## `query.ts`'s orphaned relation-getters — genuinely dead, not reused

`getDependencies`/`getDependents`/`getBlockers`/`getBlocked` (day-1 code, zero callers,
confirmed orphaned by both Huginn and Muninn independently) all take `tasks: readonly
Task[]` — a pre-materialized full array. Now that checks 2 and 4 resolve specific keys via
`resolveTaskFile` + targeted per-file reads instead of filtering a loaded array, these four
functions don't fit the design and won't be reused. Recommend deleting them as dead code
separately from this work, rather than folding them in. Check 4's cycle detection is a
fresh BFS/DFS regardless — walking the *proposed* graph (current edges plus the new one
being added) one file read per hop via `resolveTaskFile`, checking for a path back to the
origin task, with the one-hop self-reference case folding in as the trivial cycle rather
than needing special-cased handling.

## Relationship to TCL-138

Confirmed by both Huginn and Muninn: TCL-138's "task-file traversal duplication" finding
(rank 2 in the audit's port-readiness table) is about *filesystem* traversal — walking
task directories on disk to discover files (`index-update.ts`, `search.ts`, `move.ts`,
`archive.ts` each doing their own disk walk). This plan's checks do their own small,
targeted disk reads (`resolveTaskFile` plus single-file parses) rather than the batch
directory walks that finding is about — a different layer and a different shape of access
entirely. No dependency on walker-unification landing; no coordination needed with Roux's
in-progress work.

## Verification plan

- Unit tests per check in `mutate.test.ts` (and `move.test.ts` for the re-parent case),
  covering: violation blocked by default, violation allowed through with the demote flag,
  and the non-violating case still working normally.
- Existing NEEDS-REVIEW-before-DONE tests must keep passing unchanged — this is a sibling
  addition, not a rework of that rule.
- Cross-check against the current live task database (`.sandpiper/tasks/`) once
  implemented — it's known to already contain some of these violations (that's how the
  board's warnings were discovered in the first place). Confirm the check is scoped to
  "does this specific operation newly create/worsen a violation" rather than "is the whole
  graph clean," so pre-existing unrelated inconsistencies don't block unrelated future
  operations.
