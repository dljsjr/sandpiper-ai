import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import type { Command } from '@commander-js/extra-typings';
import { replaceDescription } from '../core/description.js';
import { parseFrontmatter, taskFromFrontmatter } from '../core/frontmatter.js';
import { applyFieldUpdates } from '../core/mutate.js';
import { formatRawOutput, formatTasksOutput } from '../core/output.js';
import type { TaskFilter } from '../core/query.js';
import { queryTasks } from '../core/query.js';
import type { TaskStatus } from '../core/types.js';
import {
  emitMutationResult,
  getOutputFormat,
  loadTasks,
  resolveTaskPath,
  searchToKeys,
  shouldSave,
} from './helpers.js';

export interface UpdateOptions {
  readonly status?: string;
  readonly assignee?: string;
  readonly priority?: string;
  readonly resolution?: string;
  readonly title?: string;
  readonly reporter?: string;
  readonly desc?: string;
  readonly dependsOn?: string;
  readonly blockedBy?: string;
  readonly related?: string;
}

export interface BulkFilterOptions {
  readonly project?: string;
  readonly filterStatus?: string;
  readonly search?: string;
}

export function normalizeStatus(input: string): TaskStatus {
  const normalized = input.toUpperCase().replace(/_/g, ' ');
  const valid = ['NOT STARTED', 'IN PROGRESS', 'NEEDS REVIEW', 'COMPLETE'];
  if (!valid.includes(normalized)) {
    throw new Error(`Invalid status: "${input}". Valid values: ${valid.join(', ')}`);
  }
  return normalized as TaskStatus;
}

export function buildFieldsFromOptions(opts: UpdateOptions): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (opts.status) fields.status = normalizeStatus(opts.status);
  if (opts.assignee) fields.assignee = opts.assignee.toUpperCase();
  if (opts.priority) fields.priority = opts.priority.toUpperCase();
  if (opts.resolution) fields.resolution = opts.resolution.toUpperCase();
  if (opts.title) fields.title = opts.title;
  if (opts.reporter) fields.reporter = opts.reporter.toUpperCase();
  if (opts.desc !== undefined) fields.description = opts.desc;
  if (opts.dependsOn !== undefined) {
    fields.dependsOn = opts.dependsOn ? opts.dependsOn.split(',').map((s) => s.trim()) : [];
  }
  if (opts.blockedBy !== undefined) {
    fields.blockedBy = opts.blockedBy ? opts.blockedBy.split(',').map((s) => s.trim()) : [];
  }
  if (opts.related !== undefined) {
    fields.related = opts.related ? opts.related.split(',').map((s) => s.trim()) : [];
  }
  return fields;
}

// Different subcommands provide different Commander option generics.
// These helpers only rely on root-level option access, so we erase concrete option shapes.
type AnyCommand = Command<unknown[], Record<string, unknown>, Record<string, unknown>>;

export function emitMutationOutput(
  cmd: AnyCommand,
  paths: readonly string[],
  fields: Record<string, unknown>,
  humanMessage: string,
): void {
  if (shouldSave(cmd)) {
    emitMutationResult(cmd, paths, humanMessage);
    return;
  }

  const format = getOutputFormat(cmd);
  const modified = paths.map((path) => ({
    path,
    content: applyFieldUpdates(readFileSync(path, 'utf-8'), fields),
  }));

  if (format === 'json' || format === 'toon') {
    const tasks = modified.map((taskFile) =>
      taskFromFrontmatter(basename(taskFile.path, '.md'), parseFrontmatter(taskFile.content)),
    );
    console.log(formatTasksOutput(tasks, format));
    return;
  }

  console.log(formatRawOutput(modified));
}

export function applyInteractiveFieldUpdates(content: string, fields: Record<string, unknown>): string {
  if (Object.keys(fields).length === 0) return content;
  let updated = applyFieldUpdates(content, fields);
  if (fields.description !== undefined) {
    updated = replaceDescription(updated, fields.description as string);
  }
  return updated;
}

export function resolveTargetPaths(
  key: string | undefined,
  opts: BulkFilterOptions,
  cmd: AnyCommand,
  tasksDir: string,
): string[] {
  if (key) {
    return [resolveTaskPath(tasksDir, key.toUpperCase())];
  }

  const tasks = loadTasks(cmd);
  const searchKeys = searchToKeys(cmd, opts.search, {
    project: opts.project,
  });

  const filter: TaskFilter = {
    ...(opts.project ? { project: opts.project } : {}),
    ...(opts.filterStatus ? { status: normalizeStatus(opts.filterStatus) } : {}),
    ...(searchKeys ? { keys: searchKeys } : {}),
  };

  const matched = queryTasks(tasks, filter);
  if (matched.length === 0) {
    throw new Error('No tasks matched the given filters.');
  }

  return matched.map((task) => resolveTaskPath(tasksDir, task.key));
}

export function searchFilterToTaskFilter(
  cmd: AnyCommand,
  opts: { project?: string; search?: string; parent?: string },
): TaskFilter {
  const keys = searchToKeys(cmd, opts.search, {
    project: opts.project,
    parent: opts.parent,
  });

  return {
    ...(opts.project ? { project: opts.project } : {}),
    ...(keys ? { keys } : {}),
  };
}
