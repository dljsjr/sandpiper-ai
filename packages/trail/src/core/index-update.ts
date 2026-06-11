import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { decode, encode } from '@toon-format/toon';
import { parseFrontmatter, taskFromFrontmatter } from './frontmatter.js';
import { addPathToGitignore, writeFileAtomic } from './fs.js';
import { PROJECT_KEY_RE, walkTaskFiles } from './patterns.js';
import { CURRENT_SCHEMA_VERSION, migrateIndex, validateSchemaVersion } from './schema.js';
import type { IndexedTask, ProjectCounter, TaskIndex } from './types.js';

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
  return Object.values(index.tasks).map((task) => ({
    ...task,
    dependsOn: Array.isArray(task.dependsOn) ? task.dependsOn : [],
    blockedBy: Array.isArray(task.blockedBy) ? task.blockedBy : [],
    related: Array.isArray(task.related) ? task.related : [],
  }));
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

  // Walk all active task files using the canonical terrain walker
  for (const entry of walkTaskFiles(tasksDir)) {
    const existingTask = existing?.tasks[entry.key];
    const mtimeMs = statSync(entry.path).mtimeMs;

    // Skip if not modified since last index
    if (existingTask && mtimeMs <= existingTask.lastIndexedAt) {
      tasks[entry.key] = existingTask;
      continue;
    }

    const content = readFileSync(entry.path, 'utf-8');
    const fm = parseFrontmatter(content);
    const task = taskFromFrontmatter(entry.key, fm);

    tasks[entry.key] = {
      ...task,
      ...(entry.parent ? { parent: entry.parent } : {}),
      lastIndexedAt: Date.now(),
    };
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
  const tombstoneEntries = readdirSync(tasksDir, { withFileTypes: true });
  for (const entry of tombstoneEntries) {
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
