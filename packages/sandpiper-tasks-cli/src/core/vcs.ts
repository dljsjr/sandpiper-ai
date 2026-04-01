import { existsSync } from 'node:fs';
import { join } from 'node:path';

export type VcsBackend = 'jj' | 'git' | 'none';

/**
 * Detect the VCS backend for a project root directory.
 *
 * - `.jj/` present → `"jj"` (checked first; jj repos are also git repos when colocated)
 * - `.git/` present (no `.jj/`) → `"git"`
 * - Neither → `"none"`
 */
export function detectVcsBackend(rootDir: string): VcsBackend {
  if (existsSync(join(rootDir, '.jj'))) return 'jj';
  if (existsSync(join(rootDir, '.git'))) return 'git';
  return 'none';
}
