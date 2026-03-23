/**
 * Archive completed tasks by moving them from the active project directory
 * to an archive/ subdirectory within the project.
 *
 * Archived tasks are preserved in full (not deleted) but excluded from
 * the active index. The archive/ directory is naturally ignored by the
 * index scanner since it doesn't match the subtask directory pattern.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseFrontmatter } from './frontmatter.js';
import { PROJECT_KEY_RE, TASK_FILE_RE } from './patterns.js';

const ARCHIVE_DIR = 'archive';

export interface ArchiveResult {
  /** Task keys that were archived. */
  readonly archived: string[];
  /** Task keys that were skipped (not complete, or subtasks of non-complete parents). */
  readonly skipped: string[];
}

/**
 * Archive all completed tasks in a project (or all projects).
 *
 * Moves COMPLETE task files (and their subtask directories) into
 * `<project>/archive/`. Subtasks of completed parents are moved
 * with their parent. Standalone completed subtasks whose parent
 * is not complete are skipped.
 *
 * @param tasksDir - Root tasks directory (e.g., .sandpiper/tasks/)
 * @param projectFilter - Optional project key to limit archival to one project
 * @returns Summary of archived and skipped tasks
 */
export function archiveCompletedTasks(tasksDir: string, projectFilter?: string): ArchiveResult {
  const archived: string[] = [];
  const skipped: string[] = [];

  const entries = readdirSync(tasksDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !PROJECT_KEY_RE.test(entry.name)) {
      continue;
    }

    if (projectFilter && entry.name !== projectFilter) {
      continue;
    }

    const projectKey = entry.name;
    const projectDir = join(tasksDir, projectKey);
    const archiveDir = join(projectDir, ARCHIVE_DIR);

    // Find all top-level task files in this project
    const projectEntries = readdirSync(projectDir, { withFileTypes: true });

    for (const pe of projectEntries) {
      if (!pe.isFile() || !TASK_FILE_RE.test(pe.name)) {
        continue;
      }

      const taskKey = basename(pe.name, '.md');
      const taskPath = join(projectDir, pe.name);
      const content = readFileSync(taskPath, 'utf-8');
      const fm = parseFrontmatter(content);

      if (fm.status !== 'COMPLETE') {
        skipped.push(taskKey);
        continue;
      }

      // Archive this task
      mkdirSync(archiveDir, { recursive: true });

      // Move the task file
      renameSync(taskPath, join(archiveDir, pe.name));
      archived.push(taskKey);

      // Move subtask directory if it exists
      const subtaskDir = join(projectDir, taskKey);
      if (existsSync(subtaskDir) && statSync(subtaskDir).isDirectory()) {
        renameSync(subtaskDir, join(archiveDir, taskKey));
      }
    }
  }

  return { archived, skipped };
}

/**
 * List archived tasks for a project (or all projects).
 * Returns task keys found in archive directories.
 */
export function listArchivedTasks(tasksDir: string, projectFilter?: string): string[] {
  const archivedKeys: string[] = [];

  const entries = readdirSync(tasksDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !PROJECT_KEY_RE.test(entry.name)) {
      continue;
    }

    if (projectFilter && entry.name !== projectFilter) {
      continue;
    }

    const archiveDir = join(tasksDir, entry.name, ARCHIVE_DIR);
    if (!existsSync(archiveDir)) {
      continue;
    }

    const archiveEntries = readdirSync(archiveDir, { withFileTypes: true });
    for (const ae of archiveEntries) {
      if (ae.isFile() && TASK_FILE_RE.test(ae.name)) {
        archivedKeys.push(basename(ae.name, '.md'));
      }
    }
  }

  return archivedKeys;
}
