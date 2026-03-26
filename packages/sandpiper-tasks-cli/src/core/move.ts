import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';
import { decode as decodeToon, encode as encodeToon } from '@toon-format/toon';
import { parseFrontmatter } from './frontmatter.js';
import { writeFileAtomic } from './fs.js';
import { applyFieldUpdates } from './mutate.js';
import { projectFromKey, resolveTaskFile, scanHighestNumber, TASK_FILE_RE, TASK_KEY_RE } from './patterns.js';
import type { TaskKind } from './types.js';

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

/**
 * Move a task: change project, kind, or parent.
 * Handles re-keying, file moves, subtask reparenting, tombstones, and reference updates.
 */
export function moveTask(tasksDir: string, key: string, opts: MoveOptions): MoveResult {
  // Resolve current location and metadata
  const currentProject = projectFromKey(key);
  const currentPath = resolveTaskFile(tasksDir, key);
  const content = readFileSync(currentPath, 'utf-8');
  const currentFm = parseFrontmatter(content);
  const currentKind = (currentFm.kind as string) ?? 'TASK';
  const currentParent = resolveParentFromPath(tasksDir, currentPath, currentProject);

  const targetProject = opts.project ?? currentProject;
  const targetKind = opts.kind ?? currentKind;
  const targetParent = opts.parent ?? (targetKind === 'SUBTASK' ? currentParent : undefined);

  // Validation
  if (targetKind === 'SUBTASK' && !targetParent) {
    throw new Error('Moving to SUBTASK requires --parent.');
  }
  if (targetKind === 'SUBTASK' && targetParent) {
    validateParentIsTopLevel(tasksDir, targetParent, targetProject);
  }
  if (currentKind === 'SUBTASK' && targetKind === 'SUBTASK' && targetProject !== currentProject) {
    throw new Error('Cannot move a subtask to another project without promoting it to TASK or BUG.');
  }

  const crossProject = targetProject !== currentProject;
  const reKeyMap = new Map<string, string>();

  // Collect subtasks that must move with this task
  const subtasks = collectSubtasks(tasksDir, key, currentProject);

  // Determine new key — use a local counter to avoid re-reading stale state
  let newKey: string;
  if (crossProject) {
    let nextNum = getBaseCounter(tasksDir, targetProject);
    newKey = `${targetProject}-${nextNum++}`;
    reKeyMap.set(key, newKey);
    for (const subKey of subtasks.keys()) {
      const newSubKey = `${targetProject}-${nextNum++}`;
      reKeyMap.set(subKey, newSubKey);
    }
    // Persist the final counter value
    persistCounter(tasksDir, targetProject, nextNum);
  } else {
    newKey = key;
  }

  // Determine new path
  const newPath = resolveNewPath(
    tasksDir,
    newKey,
    targetProject,
    targetKind,
    targetParent,
    crossProject ? reKeyMap : undefined,
  );

  // Update the task file content
  let newContent = content;
  if (targetKind !== currentKind) {
    newContent = applyFieldUpdates(newContent, { kind: targetKind } as Record<string, unknown>);
  }
  if (crossProject) {
    // Update key references within the file itself (title stays, key is filename-derived)
  }

  // Write to new location
  mkdirSync(join(newPath, '..'), { recursive: true });
  writeFileAtomic(newPath, newContent);

  // Move subtasks
  if (targetKind === 'SUBTASK' && targetParent) {
    // Subtasks of this task become subtasks of the new parent
    moveSubtasks(tasksDir, subtasks, targetProject, targetParent, crossProject ? reKeyMap : undefined);
  } else if (crossProject) {
    // Subtasks follow to new project under the new key
    moveSubtasks(tasksDir, subtasks, targetProject, newKey, reKeyMap);
  } else if (targetKind !== 'SUBTASK' && currentKind === 'SUBTASK') {
    // Promoting subtask — subtasks stay as-is (subtasks can't have subtasks, so none to move)
  }

  // Clean up old file (if it moved)
  if (currentPath !== newPath) {
    rmSync(currentPath, { force: true });
    // Clean up empty subtask directory
    cleanEmptyDir(join(currentPath, '..'));
    // Clean up old subtask directory if the task had subtasks
    const oldSubDir = join(tasksDir, currentProject, key);
    if (existsSync(oldSubDir)) {
      cleanEmptyDir(oldSubDir);
    }
  }

  // Write tombstones for cross-project moves
  if (crossProject) {
    for (const [oldK, newK] of reKeyMap) {
      const oldProject = projectFromKey(oldK);
      const tombstone = join(tasksDir, oldProject, `${oldK}.moved`);
      writeFileAtomic(tombstone, `${newK}\n`);
    }
  }

  // Update inbound references in all task files
  if (reKeyMap.size > 0) {
    updateAllReferences(tasksDir, reKeyMap);
  }

  return {
    oldKey: key,
    newKey,
    oldPath: currentPath,
    newPath,
    reKeyMap,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────

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
  const parentFm = parseFrontmatter(readFileSync(parentPath, 'utf-8'));
  const parentKind = parentFm.kind as string;
  if (parentKind === 'SUBTASK') {
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
  const indexPath = join(tasksDir, 'index.toon');
  let fromIndex = 1;

  if (existsSync(indexPath)) {
    try {
      const raw = decodeToon(readFileSync(indexPath, 'utf-8')) as Record<string, unknown>;
      const counters = raw.counters as Record<string, { nextTaskNumber: number }> | undefined;
      if (counters?.[project]?.nextTaskNumber) {
        fromIndex = counters[project]?.nextTaskNumber;
      }
    } catch {
      // Fall through
    }
  }

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
  project: string,
  kind: string,
  parent: string | undefined,
  reKeyMap: ReadonlyMap<string, string> | undefined,
): string {
  const projectDir = join(tasksDir, project);

  if (kind === 'SUBTASK' && parent) {
    // Resolve parent key (may have been re-keyed)
    const resolvedParent = reKeyMap?.get(parent) ?? parent;
    return join(projectDir, resolvedParent, `${newKey}.md`);
  }

  return join(projectDir, `${newKey}.md`);
}

function moveSubtasks(
  tasksDir: string,
  subtasks: Map<string, string>,
  targetProject: string,
  newParentKey: string,
  reKeyMap: ReadonlyMap<string, string> | undefined,
): void {
  const targetDir = join(tasksDir, targetProject, newParentKey);
  mkdirSync(targetDir, { recursive: true });

  for (const [oldSubKey, oldSubPath] of subtasks) {
    const newSubKey = reKeyMap?.get(oldSubKey) ?? oldSubKey;
    let content = readFileSync(oldSubPath, 'utf-8');

    // Update kind to SUBTASK if not already
    const subFm = parseFrontmatter(content);
    if (subFm.kind !== 'SUBTASK') {
      content = applyFieldUpdates(content, { kind: 'SUBTASK' } as Record<string, unknown>);
    }

    const newSubPath = join(targetDir, `${newSubKey}.md`);
    writeFileAtomic(newSubPath, content);
    rmSync(oldSubPath, { force: true });
  }
}

function updateAllReferences(tasksDir: string, reKeyMap: ReadonlyMap<string, string>): void {
  // Scan all .md files in all project directories
  for (const projectEntry of readdirSync(tasksDir, { withFileTypes: true })) {
    if (!projectEntry.isDirectory()) continue;
    const projectDir = join(tasksDir, projectEntry.name);

    updateReferencesInDir(projectDir, reKeyMap);

    // Scan subtask directories
    for (const subEntry of readdirSync(projectDir, { withFileTypes: true })) {
      if (!subEntry.isDirectory()) continue;
      updateReferencesInDir(join(projectDir, subEntry.name), reKeyMap);
    }
  }
}

function updateReferencesInDir(dir: string, reKeyMap: ReadonlyMap<string, string>): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

    const filePath = join(dir, entry.name);
    let content = readFileSync(filePath, 'utf-8');
    let changed = false;

    for (const [oldKey, newKey] of reKeyMap) {
      // Replace in frontmatter array items and anywhere else in the file
      const pattern = new RegExp(`\\b${escapeRegex(oldKey)}\\b`, 'g');
      const replaced = content.replace(pattern, newKey);
      if (replaced !== content) {
        content = replaced;
        changed = true;
      }
    }

    if (changed) {
      writeFileAtomic(filePath, content);
    }
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
