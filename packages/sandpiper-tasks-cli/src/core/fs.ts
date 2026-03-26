/**
 * Atomic filesystem utilities.
 *
 * writeFileAtomic() writes content to a temporary file then renames it
 * into place. renameSync is atomic on POSIX filesystems, so a crash
 * mid-write never produces a partial file at the target path.
 */

import { renameSync, writeFileSync } from 'node:fs';

/**
 * Write content to a file atomically.
 * Writes to a temporary sibling file (path + '.tmp') then renames
 * into place. If the process crashes during the write, the original
 * file is untouched and the .tmp file is the only artifact.
 */
export function writeFileAtomic(path: string, content: string): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content, 'utf-8');
  renameSync(tmp, path);
}
