import type { Command } from '@commander-js/extra-typings';
import { replaceDescription } from '../core/description.js';
import { normalizeAssigneeInput, normalizeReporterInput } from '../core/frontmatter.js';
import { applyFieldUpdates } from '../core/mutate.js';
import { resolveTaskFile } from '../core/patterns.js';
import type { TaskFilter } from '../core/query.js';
import { queryTasks } from '../core/query.js';
import type { TaskStatus } from '../core/types.js';
import { loadTasks, searchToKeys } from './helpers.js';

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
  readonly regex?: boolean;
  readonly ripgrep?: boolean;
  /** Confirm intent for keyless bulk mutation. Required when no task key is provided. */
  readonly bulk?: boolean;
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
  if (opts.assignee !== undefined) fields.assignee = normalizeAssigneeInput(opts.assignee);
  if (opts.priority) fields.priority = opts.priority.toUpperCase();
  if (opts.resolution) fields.resolution = opts.resolution.toUpperCase();
  if (opts.title) fields.title = opts.title;
  if (opts.reporter !== undefined) fields.reporter = normalizeReporterInput(opts.reporter);
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
  operation = 'Task mutation',
): string[] {
  if (key) {
    return [resolveTaskFile(tasksDir, key.toUpperCase())];
  }

  if (!opts.project && !opts.filterStatus && !opts.search) {
    throw new Error(
      `${operation} requires a task key or at least one explicit filter (--project, --filter-status, or --search).`,
    );
  }

  if ((opts.regex || opts.ripgrep) && !opts.search) {
    throw new Error('--regex and --ripgrep require --search.');
  }

  const tasks = loadTasks(cmd);
  const searchKeys = searchToKeys(
    cmd,
    opts.search,
    {
      project: opts.project,
    },
    { regex: opts.regex, ripgrep: opts.ripgrep },
  );

  const filter: TaskFilter = {
    ...(opts.project ? { project: opts.project } : {}),
    ...(opts.filterStatus ? { status: normalizeStatus(opts.filterStatus) } : {}),
    ...(searchKeys ? { keys: searchKeys } : {}),
  };

  const matched = queryTasks(tasks, filter);
  if (matched.length === 0) {
    throw new Error('No tasks matched the given filters.');
  }

  if (!opts.bulk) {
    throw new Error(
      `${operation} matched ${matched.length} task${matched.length !== 1 ? 's' : ''} and requires --bulk to modify them. ` +
        'Inspect matches with task list/show, then rerun with --bulk to write.',
    );
  }

  return matched.map((task) => resolveTaskFile(tasksDir, task.key));
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
