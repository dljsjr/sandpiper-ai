/**
 * Mutation-time consistency guards.
 *
 * Each guard is a targeted, per-key disk lookup (via resolveTaskFile /
 * collectSubtasks / resolveParentFromPath) rather than an operation over a
 * materialized task list — see .sandpiper/docs/specs/trail-consistency-checks-plan.md
 * for why. Guards return a violation message, or undefined when there's no
 * violation; callers decide whether to throw (default) or warn (--force).
 *
 * The `enforce*Guards` functions are per-mutation orchestrators: they own
 * "which checks apply to this operation, and in what order," keeping that
 * selection logic next to the guards themselves rather than inlined at each
 * mutate.ts/move.ts call site.
 */

import { readFileSync } from 'node:fs';
import { parseFrontmatter, taskFromFrontmatter } from './frontmatter.js';
import { collectSubtasks, resolveParentFromPath, resolveTaskFile } from './patterns.js';
import type { Task, TaskResolution, TaskStatus } from './types.js';

/**
 * Enforce a guard's result: throw by default, or print a warning and let the
 * mutation proceed when `force` is set. The single decision point every
 * guard call site shares.
 */
export function enforceGuard(violation: string | undefined, force: boolean): void {
  if (violation === undefined) return;
  if (!force) throw new Error(violation);
  console.error(`Warning: ${violation}`);
}

/**
 * COMPLETE status requires a resolution, unconditionally -- not one of the four
 * force-demotable consistency guards, just a hard invariant. Shared so updateTaskFields
 * and the --interactive path (which bypasses updateTaskFields entirely, writing via
 * writeTaskFileAuditably directly) enforce the identical rule from one definition
 * instead of two copies that happen to currently agree.
 */
export function assertCompleteRequiresResolution(
  status: TaskStatus | undefined,
  resolution: TaskResolution | undefined,
): void {
  if (status === 'COMPLETE' && !resolution) {
    throw new Error('Setting status to COMPLETE requires a resolution. Use resolution: DONE or resolution: WONTFIX.');
  }
}

function loadTaskAt(tasksDir: string, key: string): Task | undefined {
  try {
    const path = resolveTaskFile(tasksDir, key);
    return taskFromFrontmatter(key, parseFrontmatter(readFileSync(path, 'utf-8')));
  } catch {
    return undefined;
  }
}

/** Shared predicate behind checks 1b and 1d — a child/subtask can't be active while its parent is COMPLETE. */
function isActiveUnderCompleteParent(parentStatus: TaskStatus, childStatus: TaskStatus): boolean {
  return parentStatus === 'COMPLETE' && childStatus !== 'COMPLETE';
}

/**
 * Check 1a: a task being finalized to COMPLETE must not have subtasks that
 * are themselves still open. Only relevant at that final transition, not at
 * NEEDS REVIEW — a parent can go up for review while children are still in
 * flight, it just can't be marked done while they are. Applies to any task;
 * subtasks have no children of their own (max depth one level), so this is
 * a no-op for them.
 *
 * Deliberately does not exempt WONTFIX the way check 2 does -- see "WONTFIX
 * exemption" in trail-consistency-checks-plan.md for the asymmetry that makes
 * this check unsafe to treat the same way despite looking structurally similar.
 */
export function checkChildrenCompleteBeforeFinalize(
  tasksDir: string,
  parentKey: string,
  project: string,
): string | undefined {
  const subtasks = collectSubtasks(tasksDir, parentKey, project);
  const open: string[] = [];
  for (const [childKey, childPath] of subtasks) {
    const child = taskFromFrontmatter(childKey, parseFrontmatter(readFileSync(childPath, 'utf-8')));
    if (child.status !== 'COMPLETE') open.push(childKey);
  }
  if (open.length === 0) return undefined;
  return `${parentKey} has non-COMPLETE subtasks: ${open.join(', ')}`;
}

/**
 * Check 1b: a task can't be given an active (non-COMPLETE) status while its
 * own parent is COMPLETE. Covers both reopening an existing child and
 * activating one that was created after the parent finished. `childStatus`
 * is the proposed resulting status; callers only invoke this when that's
 * non-COMPLETE (see enforceUpdateFieldGuards).
 */
export function checkParentNotCompleteForActiveChild(
  tasksDir: string,
  taskPath: string,
  project: string,
  childStatus: TaskStatus,
): string | undefined {
  const parentKey = resolveParentFromPath(tasksDir, taskPath, project);
  if (!parentKey) return undefined;
  const parent = loadTaskAt(tasksDir, parentKey);
  if (parent !== undefined && isActiveUnderCompleteParent(parent.status, childStatus)) {
    return `Parent ${parentKey} is COMPLETE; cannot set an active status on its subtask.`;
  }
  return undefined;
}

/**
 * Check 1d: the re-parent counterpart of check 1b, for moveTask. Takes the
 * target parent's status and the task-being-moved's current status directly
 * since moveTask already has both in hand before the file move happens.
 */
export function checkParentNotCompleteForReparent(
  parentKey: string,
  parentStatus: TaskStatus,
  currentStatus: TaskStatus,
): string | undefined {
  if (!isActiveUnderCompleteParent(parentStatus, currentStatus)) return undefined;
  return `Parent ${parentKey} is COMPLETE; cannot re-parent an active task under it.`;
}

/**
 * Check 2: a task can't move to NEEDS REVIEW or COMPLETE (with resolution DONE)
 * while any of its blockers isn't itself COMPLETE with resolution DONE. Not applied
 * when the resulting resolution is WONTFIX -- see enforceUpdateFieldGuards, which
 * skips calling this in that case. Fails closed on a dangling blocker key (can't
 * confirm it's resolved, so it isn't) rather than skipping it — this runs from
 * enforceUpdateFieldGuards even when the call doesn't touch blockedBy at all
 * (falling back to the stored array), a call shape where checkReferencesExist never
 * runs, so this can't assume check 3 already covers a dangling key here.
 */
export function checkBlockersResolved(tasksDir: string, blockedBy: readonly string[]): string | undefined {
  const unresolved: string[] = [];
  for (const blockerKey of blockedBy) {
    const blocker = loadTaskAt(tasksDir, blockerKey);
    if (blocker === undefined || blocker.status !== 'COMPLETE' || blocker.resolution !== 'DONE') {
      unresolved.push(blockerKey);
    }
  }
  if (unresolved.length === 0) return undefined;
  return `Unresolved blocker(s): ${unresolved.join(', ')}`;
}

/**
 * Check 3: every key in a relationship array (blockedBy/dependsOn/related)
 * must resolve to an existing task file.
 */
export function checkReferencesExist(tasksDir: string, keys: readonly string[]): string | undefined {
  const missing = keys.filter((key) => loadTaskAt(tasksDir, key) === undefined);
  if (missing.length === 0) return undefined;
  return `Reference(s) not found: ${missing.join(', ')}`;
}

export type CycleRelationField = 'blockedBy' | 'dependsOn';

/**
 * Check 4: walk the proposed graph (current edges of each hop, starting from
 * the origin task's proposed new edges) for a path back to the origin task.
 * Self-reference is the trivial one-hop case of this same walk, not a
 * separate check. Dangling edges are skipped — check 3 owns that violation.
 *
 * Not called from createTask: a brand-new task's key can't already appear in
 * any existing task's blockedBy/dependsOn, since nothing could reference it
 * before it existed — it can't be part of a pre-existing cycle by construction.
 */
export function checkNoCycle(
  tasksDir: string,
  originKey: string,
  field: CycleRelationField,
  proposedEdges: readonly string[],
): string | undefined {
  const visited = new Set<string>([originKey]);
  const queue: string[] = [...proposedEdges];

  while (queue.length > 0) {
    // biome-ignore lint/style/noNonNullAssertion: queue.length > 0 guarantees shift() returns a value
    const next = queue.shift()!;
    if (next === originKey) {
      return `${originKey} has a cycle in ${field}: it eventually leads back to itself.`;
    }
    if (visited.has(next)) continue;
    visited.add(next);

    const nextTask = loadTaskAt(tasksDir, next);
    if (nextTask === undefined) continue;
    queue.push(...nextTask[field]);
  }

  return undefined;
}

// ─── Per-mutation orchestrators ───────────────────────────────────

export interface CreateTaskGuardInputs {
  readonly parent?: string;
  readonly blockedBy?: readonly string[];
  readonly dependsOn?: readonly string[];
  readonly related?: readonly string[];
}

/** Checks 1c and 3, as they apply to createTask. */
export function enforceCreateTaskGuards(tasksDir: string, inputs: CreateTaskGuardInputs, force: boolean): void {
  if (inputs.parent !== undefined) {
    const parent = loadTaskAt(tasksDir, inputs.parent);
    enforceGuard(
      parent?.status === 'COMPLETE'
        ? `Parent ${inputs.parent} is COMPLETE; cannot create an active subtask under it.`
        : undefined,
      force,
    );
  }

  for (const keys of [inputs.blockedBy, inputs.dependsOn, inputs.related]) {
    if (keys !== undefined && keys.length > 0) {
      enforceGuard(checkReferencesExist(tasksDir, keys), force);
    }
  }
}

export interface UpdateFieldGuardInputs {
  readonly status?: TaskStatus;
  readonly resolution?: TaskResolution;
  readonly blockedBy?: readonly string[];
  readonly dependsOn?: readonly string[];
  readonly related?: readonly string[];
}

/**
 * Checks 1a, 1b, 2, 3, and 4, as they apply to updateTaskFields -- and, since this is
 * the one place all of them are enforced, to every other call shape that ends up here
 * too: task update --status COMPLETE directly, and the --interactive path. Check 1a
 * (children-complete-before-finalize) does NOT get the WONTFIX exemption check 2 gets;
 * see "WONTFIX exemption" in trail-consistency-checks-plan.md for why the two checks
 * aren't safe to treat the same way despite looking structurally similar.
 */
export function enforceUpdateFieldGuards(
  tasksDir: string,
  taskPath: string,
  current: Task,
  fields: UpdateFieldGuardInputs,
  force: boolean,
): void {
  if (fields.status !== undefined && fields.status !== 'COMPLETE') {
    enforceGuard(checkParentNotCompleteForActiveChild(tasksDir, taskPath, current.project, fields.status), force);
  }

  if (fields.status === 'COMPLETE') {
    enforceGuard(checkChildrenCompleteBeforeFinalize(tasksDir, current.key, current.project), force);
  }

  const resultingStatus = fields.status ?? current.status;
  const resultingResolution = fields.resolution ?? current.resolution;
  const statusOrBlockersTouched = fields.status !== undefined || fields.blockedBy !== undefined;
  // WONTFIX is an abandon-from-anywhere resolution, same as the NEEDS-REVIEW-before-DONE
  // rule already treats it (mutate.ts's completeTask) -- an abandoned task's blockers
  // don't matter, so this check only applies on the DONE path (or the pre-finalize NEEDS
  // REVIEW step, which has no resolution yet).
  const isWontfix = resultingStatus === 'COMPLETE' && resultingResolution === 'WONTFIX';
  if (statusOrBlockersTouched && !isWontfix && (resultingStatus === 'NEEDS REVIEW' || resultingStatus === 'COMPLETE')) {
    enforceGuard(checkBlockersResolved(tasksDir, fields.blockedBy ?? current.blockedBy), force);
  }

  for (const keys of [fields.blockedBy, fields.dependsOn, fields.related]) {
    if (keys !== undefined && keys.length > 0) {
      enforceGuard(checkReferencesExist(tasksDir, keys), force);
    }
  }

  for (const [field, keys] of [
    ['blockedBy', fields.blockedBy],
    ['dependsOn', fields.dependsOn],
  ] as const) {
    if (keys !== undefined && keys.length > 0) {
      enforceGuard(checkNoCycle(tasksDir, current.key, field, keys), force);
    }
  }
}
