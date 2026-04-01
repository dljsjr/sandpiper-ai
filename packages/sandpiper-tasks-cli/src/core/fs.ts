/**
 * Atomic filesystem utilities.
 *
 * writeFileAtomic() writes content to a temporary file then renames it
 * into place. renameSync is atomic on POSIX filesystems, so a crash
 * mid-write never produces a partial file at the target path.
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Write content to a file atomically.
 * Writes to a temporary sibling file (path + '.tmp') then renames
 * into place. If the process crashes during the write, the original
 * file is untouched and the .tmp file is the only artifact.
 */
/**
 * Ensure `entry` appears in `dir/.gitignore`.
 * Creates the file if absent; appends the entry if not already present.
 * Idempotent — safe to call on every invocation.
 */
export function addPathToGitignore(dir: string, entry: string): void {
  const gitignorePath = join(dir, '.gitignore');
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf-8');
    if (content.split('\n').some((l) => l.trim() === entry)) return;
    const appended = content.endsWith('\n') ? `${content}${entry}\n` : `${content}\n${entry}\n`;
    writeFileAtomic(gitignorePath, appended);
  } else {
    writeFileAtomic(gitignorePath, `${entry}\n`);
  }
}

export function writeFileAtomic(path: string, content: string): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content, 'utf-8');
  renameSync(tmp, path);
}
