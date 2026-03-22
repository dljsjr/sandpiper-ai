import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { TASK_KEY_RE } from './patterns.js';

/** Options to narrow the search scope. */
export interface SearchScope {
  readonly project?: string;
  readonly parent?: string;
}

/**
 * Search task files for a text pattern using ripgrep.
 * Returns an array of matching task keys.
 *
 * @param tasksDir - Path to the .sandpiper/tasks directory
 * @param pattern - Text pattern to search for (case insensitive)
 * @param scope - Optional scope narrowing (project, parent)
 */
export function searchTasks(tasksDir: string, pattern: string, scope?: SearchScope): readonly string[] {
  const searchDir = resolveSearchDir(tasksDir, scope);
  if (!existsSync(searchDir)) {
    return [];
  }

  try {
    const output = execSync(
      `rg --files-with-matches --ignore-case --glob '*.md' -- ${shellQuote(pattern)} ${shellQuote(searchDir)}`,
      { encoding: 'utf-8', timeout: 10_000, stdio: ['pipe', 'pipe', 'pipe'] },
    );

    return extractTaskKeys(output);
  } catch {
    // rg exits with code 1 when no matches found — not an error
    return [];
  }
}

/**
 * Resolve the directory to search based on scope narrowing.
 */
function resolveSearchDir(tasksDir: string, scope?: SearchScope): string {
  if (!scope) return tasksDir;

  let dir = tasksDir;
  if (scope.project) {
    dir = join(dir, scope.project);
  }
  if (scope.parent) {
    dir = join(dir, scope.parent);
  }
  return dir;
}

/**
 * Extract task keys from rg output (one file path per line).
 */
function extractTaskKeys(output: string): string[] {
  const keys: string[] = [];
  for (const line of output.trim().split('\n')) {
    if (!line) continue;
    const filename = basename(line, '.md');
    if (TASK_KEY_RE.test(filename)) {
      keys.push(filename);
    }
  }
  return keys;
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}
