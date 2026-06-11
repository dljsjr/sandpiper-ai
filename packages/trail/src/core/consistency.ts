/**
 * Index consistency checks — lightweight verification that the index
 * matches the task files on disk, with automatic self-healing.
 */

import { walkTaskFiles } from './patterns.js';
import type { TaskIndex } from './types.js';

/**
 * Count the number of task files (.md) on disk across all project directories.
 * Includes top-level tasks and subtasks.
 */
export function countTaskFilesOnDisk(tasksDir: string): number {
  let count = 0;
  for (const _entry of walkTaskFiles(tasksDir)) {
    count++;
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
