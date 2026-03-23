import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Matches an uppercase project key (2+ letters): SHR, CLI, TOOLS, etc. */
export const PROJECT_KEY_RE = /^[A-Z]{2,}$/;

/** Matches a task file name: SHR-1.md, TOOLS-42.md, etc. */
export const TASK_FILE_RE = /^[A-Z]{2,}-\d+\.md$/;

/** Matches a task key: SHR-1, TOOLS-42, etc. */
export const TASK_KEY_RE = /^[A-Z]{2,}-\d+$/;

/** Extract the project key from a task key. */
export function projectFromKey(key: string): string {
  const dash = key.indexOf('-');
  if (dash === -1) throw new Error(`Invalid task key: ${key}`);
  return key.slice(0, dash);
}

/** Extract the task number from a task key. */
export function numberFromKey(key: string): number {
  const dash = key.indexOf('-');
  if (dash === -1) throw new Error(`Invalid task key: ${key}`);
  return Number.parseInt(key.slice(dash + 1), 10);
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
