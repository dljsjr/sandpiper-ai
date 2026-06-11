import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createTwoFilesPatch } from 'diff';
import { writeFileAtomic } from './fs.js';

/**
 * Write a unified diff of a task file change to the history directory.
 *
 * History files are stored at:
 *   .sandpiper/tasks/history/<KEY>/<TIMESTAMP>.diff
 *
 * @param tasksDir - Path to the .sandpiper/tasks directory
 * @param key - Task key (e.g., "SHR-1")
 * @param oldContent - File content before the change
 * @param newContent - File content after the change
 * @param timestamp - ISO timestamp for the diff filename
 */
export function writeDiff(
  tasksDir: string,
  key: string,
  oldContent: string,
  newContent: string,
  timestamp: string,
): void {
  if (oldContent === newContent) return;

  const histDir = join(tasksDir, 'history', key);
  mkdirSync(histDir, { recursive: true });

  const diff = createTwoFilesPatch(`a/${key}.md`, `b/${key}.md`, oldContent, newContent);
  // Sanitize timestamp for filename (replace colons for Windows compat)
  const safeTs = timestamp.replace(/:/g, '-');

  // Ensure unique filename (append counter if collision)
  let filename = `${safeTs}.diff`;
  let counter = 1;
  while (existsSync(join(histDir, filename))) {
    filename = `${safeTs}-${counter}.diff`;
    counter++;
  }

  writeFileAtomic(join(histDir, filename), diff);
}
