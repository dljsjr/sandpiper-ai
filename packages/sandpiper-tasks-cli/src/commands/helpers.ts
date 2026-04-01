import { existsSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import type { Command } from '@commander-js/extra-typings';
import { autoCommitIfEnabled } from '../core/auto-commit.js';
import { isIndexConsistent } from '../core/consistency.js';
import { parseFrontmatter, taskFromFrontmatter } from '../core/frontmatter.js';
import { ensureIndexGitignore, loadIndex, tasksFromIndex, updateIndex } from '../core/index-update.js';
import type { OutputFormat } from '../core/output.js';
import { formatRawOutput, formatTasksOutput } from '../core/output.js';
import { searchTasks } from '../core/search.js';
import { resolveStorageConfig } from '../core/storage-config.js';
import type { Task } from '../core/types.js';

export interface RootOptions {
  readonly dir?: string;
  readonly format?: OutputFormat;
  readonly save?: boolean; // Commander inverts --no-save to save=false
}

/**
 * Resolve the tasks directory from an optional base path.
 * If no path is given, uses the current working directory.
 *
 * @throws If the tasks directory does not exist.
 */
export function resolveTasksDir(basePath?: string): string {
  const base = basePath ? resolve(basePath) : process.cwd();
  const tasksDir = join(base, '.sandpiper', 'tasks');

  if (!existsSync(tasksDir)) {
    throw new Error(
      `Tasks directory not found: ${tasksDir}\nEnsure a .sandpiper/tasks directory exists at the target location.`,
    );
  }

  return tasksDir;
}

/**
 * Walk up to the root command and read the --dir option.
 */
// biome-ignore lint/suspicious/noExplicitAny: Commander generic params vary per command
export function getRootDir(cmd: Command<any, any, any>): string | undefined {
  // biome-ignore lint/suspicious/noExplicitAny: Commander generic params vary per command
  let root: Command<any, any, any> = cmd;
  while (root.parent) {
    // biome-ignore lint/suspicious/noExplicitAny: Commander generic params vary per command
    root = root.parent as Command<any, any, any>;
  }
  return (root.opts() as RootOptions).dir;
}

/**
 * Get all root-level options.
 */
// biome-ignore lint/suspicious/noExplicitAny: Commander generic params vary per command
export function getRootOpts(cmd: Command<any, any, any>): RootOptions {
  // biome-ignore lint/suspicious/noExplicitAny: Commander generic params vary per command
  let root: Command<any, any, any> = cmd;
  while (root.parent) {
    // biome-ignore lint/suspicious/noExplicitAny: Commander generic params vary per command
    root = root.parent as Command<any, any, any>;
  }
  return root.opts() as RootOptions;
}

/**
 * Get the effective output format from root options.
 * --no-save without --format implies "raw".
 * Returns undefined if no format output is requested (normal human-readable mode).
 */
export function getOutputFormat(
  // biome-ignore lint/suspicious/noExplicitAny: Commander generic params vary per command
  cmd: Command<any, any, any>,
): OutputFormat | undefined {
  const opts = getRootOpts(cmd);
  if (opts.format) return opts.format;
  if (opts.save === false) return 'raw';
  return undefined;
}

/**
 * Whether disk writes (task files + index) should be performed.
 */
// biome-ignore lint/suspicious/noExplicitAny: Commander generic params vary per command
export function shouldSave(cmd: Command<any, any, any>): boolean {
  return getRootOpts(cmd).save !== false;
}

/**
 * Resolve the tasks directory from a command's root --dir option.
 */
// biome-ignore lint/suspicious/noExplicitAny: Commander generic params vary per command
export function getTasksDir(cmd: Command<any, any, any>): string {
  return resolveTasksDir(getRootDir(cmd));
}

/**
 * Load tasks from the index, auto-updating if the index doesn't exist.
 */
// biome-ignore lint/suspicious/noExplicitAny: Commander generic params vary per command
export function loadTasks(cmd: Command<any, any, any>): readonly Task[] {
  const tasksDir = getTasksDir(cmd);
  ensureIndexGitignore(tasksDir);
  let index = loadIndex(tasksDir);
  if (!index) {
    index = updateIndex(tasksDir);
  } else if (!isIndexConsistent(tasksDir, index)) {
    // Index is stale — task file count doesn't match. Auto-rebuild.
    index = updateIndex(tasksDir);
  }
  return tasksFromIndex(index);
}

// Re-export resolveTaskFile as resolveTaskPath for backward compat
export { resolveTaskFile as resolveTaskPath } from '../core/patterns.js';

/**
 * After a mutation, output affected tasks in the requested format and update the index.
 * If --no-save was set, the caller should have skipped the disk write — this just handles output.
 */
export function emitMutationResult(
  // biome-ignore lint/suspicious/noExplicitAny: Commander generic params vary
  cmd: Command<any, any, any>,
  affectedPaths: readonly string[],
  humanMessage: string,
): void {
  const fmt = getOutputFormat(cmd);

  const resolved = affectedPaths.map((p) => ({
    path: p,
    content: readFileSync(p, 'utf-8'),
  }));

  if (fmt === 'raw') {
    console.log(formatRawOutput(resolved));
  } else if (fmt === 'json' || fmt === 'toon') {
    const tasks = resolved.map((f) => {
      const key = basename(f.path, '.md');
      return taskFromFrontmatter(key, parseFrontmatter(f.content));
    });
    console.log(formatTasksOutput(tasks, fmt));
  } else {
    console.log(humanMessage);
  }

  if (shouldSave(cmd)) {
    updateIndex(getTasksDir(cmd));
    const rootDir = getRootDir(cmd) ?? process.cwd();
    const config = resolveStorageConfig(rootDir);
    autoCommitIfEnabled(rootDir, config, humanMessage.split('\n')[0] ?? humanMessage);
  }
}

/**
 * Wrap a command action with consistent error handling.
 */
export function withErrorHandling(fn: () => void): void {
  try {
    fn();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // Include stderr from failed child processes (e.g. jj/git error output)
    // so the user sees *why* the command failed, not just that it did.
    const stderr = (error as { stderr?: Buffer | string })?.stderr;
    const detail = stderr ? `\n${String(stderr).trim()}` : '';
    console.error(`Error: ${msg}${detail}`);
    process.exitCode = 1;
  }
}

/**
 * Run a ripgrep search and return a Set of matching keys for use as TaskFilter.keys.
 * Returns undefined if no search term is provided (meaning "don't filter by search").
 */
export function searchToKeys(
  // biome-ignore lint/suspicious/noExplicitAny: Commander generic params vary
  cmd: Command<any, any, any>,
  searchText: string | undefined,
  scope?: { project?: string; parent?: string },
): ReadonlySet<string> | undefined {
  if (!searchText) return undefined;
  return new Set(searchTasks(getTasksDir(cmd), searchText, scope));
}
