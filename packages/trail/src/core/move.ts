import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';
import { decode as decodeToon, encode as encodeToon } from '@toon-format/toon';
import type { FieldChange } from './activity-log.js';
import { parseFrontmatter, taskFromFrontmatter } from './frontmatter.js';
import { writeFileAtomic } from './fs.js';
import { loadIndex, readProjectCounter } from './index-update.js';
import { applyInternalFieldUpdates, writeTaskFileAuditably } from './mutate.js';
import {
  projectFromKey,
  resolveTaskFile,
  scanHighestNumber,
  TASK_FILE_RE,
  TASK_KEY_RE,
  walkTaskFiles,
} from './patterns.js';
import type { IndexedTask, TaskKind } from './types.js';

export interface MoveOptions {
  readonly project?: string;
  readonly kind?: TaskKind;
  readonly parent?: string;
}

export interface MoveResult {
  readonly oldKey: string;
  readonly newKey: string;
  readonly oldPath: string;
  readonly newPath: string;
  readonly reKeyMap: ReadonlyMap<string, string>;
}

interface CurrentTaskState {
  readonly project: string;
  readonly path: string;
  readonly content: string;
  readonly kind: TaskKind;
  readonly literalKind?: string;
  readonly parent?: string;
}

interface MoveTarget {
  readonly project: string;
  readonly kind: TaskKind;
  readonly kindRequested: boolean;
  readonly parent?: string;
}

interface MovePlan {
  readonly target: MoveTarget;
  readonly subtasks: ReadonlyMap<string, string>;
  readonly crossProject: boolean;
  readonly newKey: string;
  readonly newPath: string;
  readonly reKeyMap: ReadonlyMap<string, string>;
}

/**
 * Move a task: change project, kind, or parent.
 * Handles re-keying, file moves, subtask reparenting, tombstones, and reference updates.
 */
export function moveTask(tasksDir: string, key: string, opts: MoveOptions): MoveResult {
  const current = readCurrentTask(tasksDir, key);
  const target = resolveMoveTarget(current, opts);
  validateMoveTarget(tasksDir, current, target);

  const plan = planMove(tasksDir, key, current, target);
  const moveChanges = buildMoveActivityChanges(key, plan.newKey, current, target);
  writeMovedTaskFile(
    tasksDir,
    plan.newPath,
    current.content,
    applyMoveFieldUpdates(current.content, current, target),
    key,
    moveChanges,
  );
  moveSubtasksForPlan(tasksDir, plan);
  removeOriginalTaskFiles(tasksDir, key, current, plan.newPath);
  writeMoveTombstones(tasksDir, plan.reKeyMap);
  updateInboundReferences(tasksDir, plan.reKeyMap);

  return {
    oldKey: key,
    newKey: plan.newKey,
    oldPath: current.path,
    newPath: plan.newPath,
    reKeyMap: plan.reKeyMap,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────

function readCurrentTask(tasksDir: string, key: string): CurrentTaskState {
  const project = projectFromKey(key);
  const path = resolveTaskFile(tasksDir, key);
  const content = readFileSync(path, 'utf-8');
  const frontmatter = parseFrontmatter(content);
  const task = taskFromFrontmatter(key, frontmatter);
  const literalKind = typeof frontmatter.kind === 'string' ? frontmatter.kind : undefined;

  return {
    project,
    path,
    content,
    kind: task.kind,
    ...(literalKind !== undefined ? { literalKind } : {}),
    parent: resolveParentFromPath(tasksDir, path, project),
  };
}

function resolveMoveTarget(current: CurrentTaskState, opts: MoveOptions): MoveTarget {
  const kind = opts.kind ?? current.kind;

  return {
    project: opts.project ?? current.project,
    kind,
    kindRequested: opts.kind !== undefined,
    parent: opts.parent ?? (kind === 'SUBTASK' ? current.parent : undefined),
  };
}

function validateMoveTarget(tasksDir: string, current: CurrentTaskState, target: MoveTarget): void {
  if (target.kind === 'SUBTASK' && !target.parent) {
    throw new Error('Moving to SUBTASK requires --parent.');
  }
  if (target.kind === 'SUBTASK' && target.parent) {
    validateParentIsTopLevel(tasksDir, target.parent, target.project);
  }
  if (current.kind === 'SUBTASK' && target.kind === 'SUBTASK' && target.project !== current.project) {
    throw new Error('Cannot move a subtask to another project without promoting it to TASK or BUG.');
  }
}

function planMove(tasksDir: string, key: string, current: CurrentTaskState, target: MoveTarget): MovePlan {
  const crossProject = target.project !== current.project;
  const subtasks = collectSubtasks(tasksDir, key, current.project);
  const { newKey, reKeyMap } = allocateMoveKeys(tasksDir, key, target.project, crossProject, subtasks);

  return {
    target,
    subtasks,
    crossProject,
    newKey,
    newPath: resolveNewPath(tasksDir, newKey, target, crossProject ? reKeyMap : undefined),
    reKeyMap,
  };
}

function allocateMoveKeys(
  tasksDir: string,
  key: string,
  targetProject: string,
  crossProject: boolean,
  subtasks: ReadonlyMap<string, string>,
): { readonly newKey: string; readonly reKeyMap: ReadonlyMap<string, string> } {
  const reKeyMap = new Map<string, string>();
  if (!crossProject) {
    return { newKey: key, reKeyMap };
  }

  let nextNum = getBaseCounter(tasksDir, targetProject);
  const newKey = `${targetProject}-${nextNum++}`;
  reKeyMap.set(key, newKey);

  for (const subKey of subtasks.keys()) {
    const newSubKey = `${targetProject}-${nextNum++}`;
    reKeyMap.set(subKey, newSubKey);
  }

  persistCounter(tasksDir, targetProject, nextNum);
  return { newKey, reKeyMap };
}

function applyMoveFieldUpdates(content: string, current: CurrentTaskState, target: MoveTarget): string {
  if (!target.kindRequested || target.kind === (current.literalKind ?? current.kind)) {
    return content;
  }
  return applyInternalFieldUpdates(content, { kind: target.kind });
}

function buildMoveActivityChanges(
  oldKey: string,
  newKey: string,
  current: CurrentTaskState,
  target: MoveTarget,
): FieldChange[] {
  const changes: FieldChange[] = [];
  if (oldKey !== newKey) {
    changes.push({ field: 'key', from: oldKey, to: newKey });
  }
  if (target.kindRequested && target.kind !== (current.literalKind ?? current.kind)) {
    changes.push({ field: 'kind', from: current.literalKind ?? current.kind, to: target.kind });
  }
  const targetParent = target.kind === 'SUBTASK' ? target.parent : undefined;
  if (targetParent !== current.parent) {
    changes.push({
      field: 'parent',
      from: current.parent ?? '(none)',
      to: targetParent ?? '(none)',
    });
  }
  return changes;
}

function writeMovedTaskFile(
  tasksDir: string,
  newPath: string,
  originalContent: string,
  newContent: string,
  historyKey: string,
  changes: readonly FieldChange[],
): void {
  mkdirSync(join(newPath, '..'), { recursive: true });
  writeTaskFileAuditably({
    taskPath: newPath,
    tasksDir,
    originalContent,
    newContent,
    changes,
    historyKey,
  });
}

function moveSubtasksForPlan(tasksDir: string, plan: MovePlan): void {
  if (plan.target.kind === 'SUBTASK' && plan.target.parent) {
    // Subtasks of this task become subtasks of the new parent.
    moveSubtasks(
      tasksDir,
      plan.subtasks,
      plan.target.project,
      plan.target.parent,
      plan.crossProject ? plan.reKeyMap : undefined,
    );
    return;
  }

  if (plan.crossProject) {
    // Subtasks follow to the new project under the re-keyed parent.
    moveSubtasks(tasksDir, plan.subtasks, plan.target.project, plan.newKey, plan.reKeyMap);
  }
}

function removeOriginalTaskFiles(tasksDir: string, key: string, current: CurrentTaskState, newPath: string): void {
  if (current.path === newPath) {
    return;
  }

  rmSync(current.path, { force: true });
  cleanEmptyDir(join(current.path, '..'));

  const oldSubDir = join(tasksDir, current.project, key);
  if (existsSync(oldSubDir)) {
    cleanEmptyDir(oldSubDir);
  }
}

function writeMoveTombstones(tasksDir: string, reKeyMap: ReadonlyMap<string, string>): void {
  for (const [oldKey, newKey] of reKeyMap) {
    const oldProject = projectFromKey(oldKey);
    const tombstone = join(tasksDir, oldProject, `${oldKey}.moved`);
    writeFileAtomic(tombstone, `${newKey}\n`);
  }
}

function updateInboundReferences(tasksDir: string, reKeyMap: ReadonlyMap<string, string>): void {
  if (reKeyMap.size > 0) {
    updateAllReferences(tasksDir, reKeyMap);
  }
}

function resolveParentFromPath(tasksDir: string, taskPath: string, project: string): string | undefined {
  const projectDir = join(tasksDir, project);
  const dir = join(taskPath, '..');
  if (dir === projectDir) return undefined;
  const parentKey = basename(dir);
  return TASK_KEY_RE.test(parentKey) ? parentKey : undefined;
}

function validateParentIsTopLevel(tasksDir: string, parentKey: string, project: string): void {
  const parentPath = join(tasksDir, project, `${parentKey}.md`);
  if (!existsSync(parentPath)) {
    throw new Error(`Parent task not found at top level: ${parentKey}`);
  }
  const parentTask = taskFromFrontmatter(parentKey, parseFrontmatter(readFileSync(parentPath, 'utf-8')));
  if (parentTask.kind === 'SUBTASK') {
    throw new Error(`Cannot make a subtask of ${parentKey} — it is itself a SUBTASK. Parent must be a TASK or BUG.`);
  }
}

function collectSubtasks(tasksDir: string, parentKey: string, project: string): Map<string, string> {
  const subtaskDir = join(tasksDir, project, parentKey);
  const subtasks = new Map<string, string>(); // key → path

  if (!existsSync(subtaskDir)) return subtasks;

  for (const entry of readdirSync(subtaskDir, { withFileTypes: true })) {
    if (!entry.isFile() || !TASK_FILE_RE.test(entry.name)) continue;
    const subKey = basename(entry.name, '.md');
    subtasks.set(subKey, join(subtaskDir, entry.name));
  }

  return subtasks;
}

/**
 * Get the base counter value for a project (the next available number).
 */
function getBaseCounter(tasksDir: string, project: string): number {
  const fromIndex = readProjectCounter(tasksDir, project) ?? 1;
  return Math.max(fromIndex, scanHighestNumber(tasksDir, project) + 1);
}

/**
 * Persist a counter value to the index file.
 */
function persistCounter(tasksDir: string, project: string, nextNum: number): void {
  const indexPath = join(tasksDir, 'index.toon');
  if (!existsSync(indexPath)) return;

  try {
    const raw = decodeToon(readFileSync(indexPath, 'utf-8')) as Record<string, unknown>;
    const counters = (raw.counters ?? {}) as Record<string, { projectKey: string; nextTaskNumber: number }>;
    counters[project] = { projectKey: project, nextTaskNumber: nextNum };
    raw.counters = counters;
    writeFileAtomic(indexPath, encodeToon(raw));
  } catch {
    // Non-fatal
  }
}

function resolveNewPath(
  tasksDir: string,
  newKey: string,
  target: MoveTarget,
  reKeyMap: ReadonlyMap<string, string> | undefined,
): string {
  const projectDir = join(tasksDir, target.project);

  if (target.kind === 'SUBTASK' && target.parent) {
    // Resolve parent key (may have been re-keyed)
    const resolvedParent = reKeyMap?.get(target.parent) ?? target.parent;
    return join(projectDir, resolvedParent, `${newKey}.md`);
  }

  return join(projectDir, `${newKey}.md`);
}

function moveSubtasks(
  tasksDir: string,
  subtasks: ReadonlyMap<string, string>,
  targetProject: string,
  newParentKey: string,
  reKeyMap: ReadonlyMap<string, string> | undefined,
): void {
  const targetDir = join(tasksDir, targetProject, newParentKey);
  mkdirSync(targetDir, { recursive: true });

  for (const [oldSubKey, oldSubPath] of subtasks) {
    const newSubKey = reKeyMap?.get(oldSubKey) ?? oldSubKey;
    const originalContent = readFileSync(oldSubPath, 'utf-8');
    let content = originalContent;

    // Update kind to SUBTASK if not already.
    // Branch on canonical task shape; keep the literal field for audit provenance.
    const subFm = parseFrontmatter(content);
    const subTask = taskFromFrontmatter(oldSubKey, subFm);
    const literalKind = typeof subFm.kind === 'string' ? subFm.kind : undefined;
    const kindChanged = subTask.kind !== 'SUBTASK';
    if (kindChanged) {
      content = applyInternalFieldUpdates(content, { kind: 'SUBTASK' });
    }

    const newSubPath = join(targetDir, `${newSubKey}.md`);

    const subChanges: FieldChange[] = [];
    if (oldSubKey !== newSubKey) {
      subChanges.push({ field: 'key', from: oldSubKey, to: newSubKey });
    }
    if (kindChanged) {
      subChanges.push({ field: 'kind', from: literalKind, to: 'SUBTASK' });
    }
    // A move is always a meaningful event — record it even when content is unchanged
    if (subChanges.length === 0) {
      subChanges.push({ field: 'location', from: undefined, to: 'moved' });
    }

    writeTaskFileAuditably({
      taskPath: newSubPath,
      tasksDir,
      originalContent,
      newContent: content,
      changes: subChanges,
      historyKey: oldSubKey,
    });
    rmSync(oldSubPath, { force: true });
  }
}

function updateAllReferences(tasksDir: string, reKeyMap: ReadonlyMap<string, string>): void {
  const index = loadIndex(tasksDir);
  if (!index) {
    updateReferencesByScanningTaskFiles(tasksDir, reKeyMap);
    return;
  }

  for (const task of Object.values(index.tasks)) {
    const filePath = resolveIndexedTaskPath(tasksDir, task, reKeyMap);
    if (existsSync(filePath)) {
      updateReferencesInFile(filePath, reKeyMap, tasksDir);
    }
  }
}

function updateReferencesByScanningTaskFiles(tasksDir: string, reKeyMap: ReadonlyMap<string, string>): void {
  for (const entry of walkTaskFiles(tasksDir)) {
    updateReferencesInFile(entry.path, reKeyMap, tasksDir);
  }
}

function resolveIndexedTaskPath(tasksDir: string, task: IndexedTask, reKeyMap: ReadonlyMap<string, string>): string {
  const key = reKeyMap.get(task.key) ?? task.key;
  const project = projectFromKey(key);
  if (task.parent) {
    const parent = reKeyMap.get(task.parent) ?? task.parent;
    const subtaskPath = join(tasksDir, project, parent, `${key}.md`);
    if (existsSync(subtaskPath)) {
      return subtaskPath;
    }
  }
  return join(tasksDir, project, `${key}.md`);
}

function updateReferencesInFile(filePath: string, reKeyMap: ReadonlyMap<string, string>, tasksDir: string): void {
  const originalContent = readFileSync(filePath, 'utf-8');
  let content = originalContent;
  let changed = false;

  for (const [oldKey, newKey] of reKeyMap) {
    // Replace in frontmatter array items and anywhere else in indexed task files.
    const pattern = new RegExp(`\\b${escapeRegex(oldKey)}\\b`, 'g');
    const replaced = content.replace(pattern, newKey);
    if (replaced !== content) {
      content = replaced;
      changed = true;
    }
  }

  if (changed) {
    // Build change descriptions for the re-key references
    const changes: Array<{ field: string; from: string | undefined; to: string }> = [];
    for (const [oldKey, newKey] of reKeyMap) {
      if (originalContent.includes(oldKey)) {
        changes.push({ field: 'references', from: oldKey, to: newKey });
      }
    }
    writeTaskFileAuditably({
      taskPath: filePath,
      tasksDir,
      originalContent,
      newContent: content,
      changes,
    });
  }
}

function cleanEmptyDir(dir: string): void {
  try {
    const entries = readdirSync(dir);
    if (entries.length === 0) {
      rmSync(dir);
    }
  } catch {
    // Non-fatal
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
