import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { decode, encode } from '@toon-format/toon';
import { parseFrontmatter } from './frontmatter.js';
import { addPathToGitignore, writeFileAtomic } from './fs.js';
import { PROJECT_KEY_RE, TASK_FILE_RE } from './patterns.js';
import { CURRENT_SCHEMA_VERSION, migrateIndex, validateSchemaVersion } from './schema.js';
import type {
  IndexedTask,
  ProjectCounter,
  TaskAssignee,
  TaskIndex,
  TaskKind,
  TaskPriority,
  TaskReporter,
  TaskResolution,
  TaskStatus,
} from './types.js';

const INDEX_FILENAME = 'index.toon';
const INDEX_GITIGNORE_ENTRY = 'index.toon';

/**
 * Ensure the tasks directory has a .gitignore that excludes index.toon.
 * Idempotent — safe to call on every invocation.
 */
export function ensureIndexGitignore(tasksDir: string): void {
  addPathToGitignore(tasksDir, INDEX_GITIGNORE_ENTRY);
}

/**
 * Load an existing index from disk. Returns null if no index file exists.
 */
export function loadIndex(tasksDir: string): TaskIndex | null {
  const indexPath = join(tasksDir, INDEX_FILENAME);
  if (!existsSync(indexPath)) {
    return null;
  }

  const content = readFileSync(indexPath, 'utf-8');
  const raw = decode(content) as Record<string, unknown>;

  validateSchemaVersion(raw);
  return migrateIndex(raw as unknown as TaskIndex);
}

/**
 * Read a project's next task counter from the index if available.
 * Returns undefined when the index is missing/unreadable or the project has no counter.
 */
export function readProjectCounter(tasksDir: string, projectKey: string): number | undefined {
  try {
    return loadIndex(tasksDir)?.counters[projectKey]?.nextTaskNumber;
  } catch {
    return undefined;
  }
}

/**
 * Save an index to disk in TOON format.
 */
export function saveIndex(tasksDir: string, index: TaskIndex): void {
  const indexPath = join(tasksDir, INDEX_FILENAME);
  writeFileAtomic(indexPath, encode(index));
}

/**
 * Extract a flat array of Tasks from the index (for use with the Query API).
 * Strips the index-specific `lastIndexedAt` field.
 */
export function tasksFromIndex(index: TaskIndex): IndexedTask[] {
  return Object.values(index.tasks);
}

/**
 * Scan the tasks directory, parse task files, and update the index.
 *
 * - Creates the index file if it doesn't exist
 * - Skips files that haven't been modified since last index (mtime check)
 * - Removes tasks from the index that no longer exist on disk
 * - Returns the updated index
 */
export function updateIndex(tasksDir: string): TaskIndex {
  ensureIndexGitignore(tasksDir);
  const existing = loadIndex(tasksDir);

  const tasks: Record<string, IndexedTask> = {};

  // Discover project directories
  const entries = readdirSync(tasksDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !PROJECT_KEY_RE.test(entry.name)) {
      continue;
    }

    const projectKey = entry.name;
    const projectDir = join(tasksDir, projectKey);

    // Scan top-level task files
    scanTaskFiles(projectDir, projectKey, undefined, existing, tasks);

    // Scan subtask directories (named like "SHR-1", matching a task key pattern)
    const projectEntries = readdirSync(projectDir, { withFileTypes: true });
    for (const pe of projectEntries) {
      if (!pe.isDirectory()) {
        continue;
      }
      if (!/^[A-Z]{2,}-\d+$/.test(pe.name)) {
        continue;
      }

      const subtaskDir = join(projectDir, pe.name);
      scanTaskFiles(subtaskDir, projectKey, pe.name, existing, tasks);
    }
  }

  // Build counters: preserve existing counters, only rebuild for missing projects
  // or when scanned tasks show a higher number than the stored counter.
  const counters: Record<string, ProjectCounter> = {
    ...(existing?.counters ?? {}),
  };

  // Scan tasks for highest number per project
  const scannedHighest: Record<string, number> = {};
  for (const task of Object.values(tasks)) {
    const numMatch = task.key.match(/-(\d+)$/);
    if (!numMatch) continue;
    // biome-ignore lint/style/noNonNullAssertion: regex capture group guaranteed by match
    const num = Number.parseInt(numMatch[1]!, 10);
    scannedHighest[task.project] = Math.max(scannedHighest[task.project] ?? 0, num);
  }

  // Also scan .moved tombstone files for counter purposes
  for (const entry of entries) {
    if (!entry.isDirectory() || !PROJECT_KEY_RE.test(entry.name)) continue;
    const projectDir = join(tasksDir, entry.name);
    for (const file of readdirSync(projectDir)) {
      const movedMatch = file.match(/^([A-Z]{2,})-(\d+)\.moved$/);
      if (movedMatch) {
        // biome-ignore lint/style/noNonNullAssertion: regex capture group guaranteed by match
        const project = movedMatch[1]!;
        // biome-ignore lint/style/noNonNullAssertion: regex capture group guaranteed by match
        const num = Number.parseInt(movedMatch[2]!, 10);
        scannedHighest[project] = Math.max(scannedHighest[project] ?? 0, num);
      }
    }
  }

  // For each project found in scan, ensure counter is at least highest+1
  for (const [project, highest] of Object.entries(scannedHighest)) {
    const existingCounter = counters[project]?.nextTaskNumber ?? 0;
    const scannedNext = highest + 1;
    if (scannedNext > existingCounter) {
      counters[project] = {
        projectKey: project,
        nextTaskNumber: scannedNext,
      };
    }
  }

  const index: TaskIndex = {
    version: CURRENT_SCHEMA_VERSION,
    lastUpdatedAt: Date.now(),
    tasks,
    counters,
  };

  saveIndex(tasksDir, index);
  return index;
}

/**
 * Scan a directory for task .md files and add them to the tasks record.
 */
function scanTaskFiles(
  dir: string,
  projectKey: string,
  parentKey: string | undefined,
  existing: TaskIndex | null,
  tasks: Record<string, IndexedTask>,
): void {
  if (!existsSync(dir)) {
    return;
  }

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !TASK_FILE_RE.test(entry.name)) {
      continue;
    }

    const taskKey = basename(entry.name, '.md');
    const taskPath = join(dir, entry.name);
    const stat = statSync(taskPath);
    const mtimeMs = stat.mtimeMs;

    // Check if we can skip this file (not modified since last index)
    const existingTask = existing?.tasks[taskKey];
    if (existingTask && mtimeMs <= existingTask.lastIndexedAt) {
      tasks[taskKey] = existingTask;
      continue;
    }

    // Parse the file
    const content = readFileSync(taskPath, 'utf-8');
    const fm = parseFrontmatter(content);

    const resolution = asString(fm.resolution) as TaskResolution | undefined;
    const indexedTask: IndexedTask = {
      key: taskKey,
      project: projectKey,
      title: asString(fm.title) ?? taskKey,
      status: (asString(fm.status) as TaskStatus) ?? 'NOT STARTED',
      kind: (asString(fm.kind) as TaskKind) ?? 'TASK',
      priority: (asString(fm.priority) as TaskPriority) ?? 'MEDIUM',
      assignee: (asString(fm.assignee) as TaskAssignee) ?? 'UNASSIGNED',
      reporter: (asString(fm.reporter) as TaskReporter) ?? 'USER',
      createdAt: asString(fm.created_at) ?? '',
      updatedAt: asString(fm.updated_at) ?? '',
      ...(resolution ? { resolution } : {}),
      dependsOn: asStringArray(fm.depends_on),
      blockedBy: asStringArray(fm.blocked_by),
      related: asStringArray(fm.related),
      ...(parentKey ? { parent: parentKey } : {}),
      lastIndexedAt: Date.now(),
    };

    tasks[taskKey] = indexedTask;
  }
}

function asString(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') return value;
  return undefined;
}

function asStringArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return [value];
  return [];
}
