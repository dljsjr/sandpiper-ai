import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Matches an uppercase project key (2+ letters): SHR, CLI, TOOLS, etc. */
export const PROJECT_KEY_RE = /^[A-Z]{2,}$/;

/** Filename for per-project metadata files. */
export const PROJECT_METADATA_FILENAME = 'PROJECT.md';

/** Matches a task file name: SHR-1.md, TOOLS-42.md, etc. */
export const TASK_FILE_RE = /^[A-Z]{2,}-\d+\.md$/;

/** Matches a task key: SHR-1, TOOLS-42, etc. */
export const TASK_KEY_RE = /^[A-Z]{2,}-\d+$/;

/** Matches a subtask directory name: SHR-1, TOOLS-42, etc. */
const SUBTASK_DIR_RE = /^[A-Z]{2,}-\d+$/;

/** Directory name for archived tasks (excluded from active traversal). */
const ARCHIVE_DIR = 'archive';

/** A task file discovered on disk by the terrain walker. */
export interface TaskFileEntry {
  readonly key: string;
  readonly project: string;
  readonly path: string;
  readonly parent?: string;
}

/**
 * Walk all active task files in a tasks directory.
 *
 * Yields one entry per .md task file, including top-level tasks
 * and one-level subtasks. Excludes archive directories, tombstones,
 * and non-task files.
 */
export function* walkTaskFiles(tasksDir: string): Generator<TaskFileEntry> {
  if (!existsSync(tasksDir)) return;

  const entries = readdirSync(tasksDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !PROJECT_KEY_RE.test(entry.name)) continue;

    const projectDir = join(tasksDir, entry.name);
    yield* walkProjectDir(projectDir, entry.name);
  }
}

function* walkProjectDir(projectDir: string, project: string): Generator<TaskFileEntry> {
  const entries = readdirSync(projectDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === ARCHIVE_DIR) continue;

    if (entry.isFile() && TASK_FILE_RE.test(entry.name)) {
      const key = entry.name.replace(/\.md$/, '');
      yield {
        key,
        project,
        path: join(projectDir, entry.name),
      };
    }

    if (entry.isDirectory() && SUBTASK_DIR_RE.test(entry.name)) {
      const parentKey = entry.name;
      const subtaskDir = join(projectDir, entry.name);
      yield* walkSubtaskDir(subtaskDir, project, parentKey);
    }
  }
}

function* walkSubtaskDir(subtaskDir: string, project: string, parentKey: string): Generator<TaskFileEntry> {
  const entries = readdirSync(subtaskDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && TASK_FILE_RE.test(entry.name)) {
      const key = entry.name.replace(/\.md$/, '');
      yield {
        key,
        project,
        path: join(subtaskDir, entry.name),
        parent: parentKey,
      };
    }
  }
}

/** Extract the project key from a task key. */
export function projectFromKey(key: string): string {
  const dash = key.indexOf('-');
  if (dash === -1) throw new Error(`Invalid task key: ${key}`);
  return key.slice(0, dash);
}

/**
 * Resolve a task key to its file path on disk.
 * Searches the project root and subtask directories.
 */
export function resolveTaskFile(tasksDir: string, key: string): string {
  const project = projectFromKey(key);
  const projectDir = join(tasksDir, project);

  const topLevel = join(projectDir, `${key}.md`);
  if (existsSync(topLevel)) return topLevel;

  if (existsSync(projectDir)) {
    for (const entry of readdirSync(projectDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const subtaskPath = join(projectDir, entry.name, `${key}.md`);
      if (existsSync(subtaskPath)) return subtaskPath;
    }
  }

  throw new Error(`Task file not found: ${key}`);
}

/**
 * Scan a project directory for the highest task number
 * (considering both .md files and .moved tombstones).
 */
export function scanHighestNumber(tasksDir: string, projectKey: string): number {
  const projectDir = join(tasksDir, projectKey);
  if (!existsSync(projectDir)) return 0;

  let highest = 0;
  const pattern = new RegExp(`^${projectKey}-(\\d+)\\.(md|moved)$`);

  for (const entry of readdirSync(projectDir, { withFileTypes: true })) {
    const match = entry.name.match(pattern);
    if (match) {
      // biome-ignore lint/style/noNonNullAssertion: regex capture group guaranteed by match
      highest = Math.max(highest, Number.parseInt(match[1]!, 10));
    }
    if (entry.isDirectory()) {
      for (const sub of readdirSync(join(projectDir, entry.name))) {
        const subMatch = sub.match(pattern);
        if (subMatch) {
          // biome-ignore lint/style/noNonNullAssertion: regex capture group guaranteed by match
          highest = Math.max(highest, Number.parseInt(subMatch[1]!, 10));
        }
      }
    }
  }

  return highest;
}
