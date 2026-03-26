/**
 * Index consistency checks — lightweight verification that the index
 * matches the task files on disk, with automatic self-healing.
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PROJECT_KEY_RE, TASK_FILE_RE } from './patterns.js';
import type { TaskIndex } from './types.js';

/**
 * Count the number of task files (.md) on disk across all project directories.
 * Includes top-level tasks and subtasks.
 */
export function countTaskFilesOnDisk(tasksDir: string): number {
  let count = 0;

  const entries = readdirSync(tasksDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !PROJECT_KEY_RE.test(entry.name)) {
      continue;
    }

    const projectDir = join(tasksDir, entry.name);
    const projectEntries = readdirSync(projectDir, { withFileTypes: true });

    for (const pe of projectEntries) {
      if (pe.isFile() && TASK_FILE_RE.test(pe.name)) {
        count++;
      }
      // Scan subtask directories
      if (pe.isDirectory() && /^[A-Z]{2,}-\d+$/.test(pe.name)) {
        const subtaskDir = join(projectDir, pe.name);
        if (existsSync(subtaskDir)) {
          for (const se of readdirSync(subtaskDir, { withFileTypes: true })) {
            if (se.isFile() && TASK_FILE_RE.test(se.name)) {
              count++;
            }
          }
        }
      }
    }
  }

  return count;
}

/**
 * Check whether the index is consistent with the task files on disk.
 * Returns true if the counts match, false if the index is stale.
 */
export function isIndexConsistent(tasksDir: string, index: TaskIndex): boolean {
  const indexCount = Object.keys(index.tasks).length;
  const diskCount = countTaskFilesOnDisk(tasksDir);
  return indexCount === diskCount;
}
