import { readFileSync } from 'node:fs';
import { Command } from '@commander-js/extra-typings';
import { formatTaskLine } from '../core/format.js';
import { normalizeAssigneeInput } from '../core/frontmatter.js';
import { formatRawOutput, formatTasksOutput } from '../core/output.js';
import { resolveTaskFile } from '../core/patterns.js';
import type { SortField, TaskFilter } from '../core/query.js';
import { queryTasks } from '../core/query.js';
import { searchTasks } from '../core/search.js';
import type { Task, TaskAssignee, TaskKind, TaskPriority } from '../core/types.js';
import { getOutputFormat, getTasksDir, loadTasks, withErrorHandling } from './helpers.js';
import { normalizeStatus } from './task-cmd-helpers.js';

export const taskListCommand = new Command('list')
  .description('List tasks with optional filters')
  .option('-p, --project <key>', 'Filter by project key')
  .option('-s, --status <status>', 'Filter by status (NOT_STARTED, IN_PROGRESS, NEEDS_REVIEW, COMPLETE)')
  .option('-k, --kind <kind>', 'Filter by kind (TASK, BUG, SUBTASK)')
  .option('--priority <priority>', 'Filter by priority (LOW, MEDIUM, HIGH)')
  .option('-a, --assignee <assignee>', 'Filter by assignee')
  .option('--parent <key>', 'Filter subtasks of a specific parent')
  .option('--top-level', 'Show only top-level tasks (no subtasks)')
  .option('--subtasks-only', 'Show only subtasks')
  .option('--sort <field>', 'Sort by field (relevance, key, priority, status, createdAt, updatedAt)')
  .option('--desc', 'Sort descending')
  .option('--limit <n>', 'Limit number of results')
  .option('-q, --search <text>', 'Full-text search in task files (defaults to BM25 relevance)')
  .option('--regex', 'Use JavaScript regex search (or ripgrep regex search with --ripgrep)')
  .option('--ripgrep', 'Use ripgrep search instead of the built-in search backend')
  .action((opts, cmd) => {
    withErrorHandling(() => {
      if (!opts.search && (opts.regex || opts.ripgrep)) {
        throw new Error('--regex and --ripgrep require --search.');
      }

      const tasks = loadTasks(cmd);
      const tasksDir = getTasksDir(cmd);
      const limit = opts.limit ? Number.parseInt(opts.limit, 10) : undefined;
      const searchKeyOrder = opts.search
        ? searchTasks(
            tasksDir,
            opts.search,
            { project: opts.project, parent: opts.parent },
            { regex: opts.regex, ripgrep: opts.ripgrep, limit },
          )
        : undefined;
      const sortField = normalizeSortField(opts.sort, opts.search !== undefined);
      const filter: TaskFilter = {
        ...(opts.project ? { project: opts.project } : {}),
        ...(searchKeyOrder ? { keys: new Set(searchKeyOrder) } : {}),
        ...(opts.status ? { status: normalizeStatus(opts.status) } : {}),
        ...(opts.kind ? { kind: opts.kind.toUpperCase() as TaskKind } : {}),
        ...(opts.priority ? { priority: opts.priority.toUpperCase() as TaskPriority } : {}),
        ...(opts.assignee !== undefined ? { assignee: normalizeAssigneeInput(opts.assignee) as TaskAssignee } : {}),
        ...(opts.parent ? { parent: opts.parent } : {}),
        ...(opts.topLevel ? { isSubtask: false } : {}),
        ...(opts.subtasksOnly ? { isSubtask: true } : {}),
      };

      const queried = queryTasks(tasks, filter, {
        ...(sortField !== 'relevance' ? { sort: { field: sortField, order: opts.desc ? 'desc' : 'asc' } } : {}),
        limit: opts.search ? undefined : limit,
      });
      const result = sortField === 'relevance' && searchKeyOrder ? sortBySearchRank(queried, searchKeyOrder) : queried;

      const format = getOutputFormat(cmd);
      if (format && format !== 'raw') {
        console.log(formatTasksOutput(result, format));
        return;
      }

      if (format === 'raw') {
        const files = result.map((task) => {
          const path = resolveTaskFile(getTasksDir(cmd), task.key);
          return { path, content: readFileSync(path, 'utf-8') };
        });
        console.log(formatRawOutput(files));
        return;
      }

      const visibleResult = addHiddenParentContext(result, tasks);

      if (visibleResult.length === 0) {
        console.log('No tasks found matching the given filters.');
        return;
      }

      for (const task of visibleResult) {
        console.log(formatTaskLine(task));
      }
      console.log(`\n${visibleResult.length} task${visibleResult.length !== 1 ? 's' : ''}`);
    });
  });

type TaskListSortField = SortField | 'relevance';

function normalizeSortField(input: string | undefined, hasSearch: boolean): TaskListSortField {
  const field = input ?? (hasSearch ? 'relevance' : 'priority');
  const valid = ['relevance', 'key', 'priority', 'status', 'createdAt', 'updatedAt'];
  if (!valid.includes(field)) {
    throw new Error(`Invalid sort field: "${field}". Valid values: ${valid.join(', ')}`);
  }
  if (field === 'relevance' && !hasSearch) {
    throw new Error('--sort relevance requires --search.');
  }
  return field as TaskListSortField;
}

function sortBySearchRank(tasks: readonly Task[], keyOrder: readonly string[]): readonly Task[] {
  const rank = new Map(keyOrder.map((key, index) => [key, index]));
  return [...tasks].sort(
    (left, right) => (rank.get(left.key) ?? Number.MAX_SAFE_INTEGER) - (rank.get(right.key) ?? Number.MAX_SAFE_INTEGER),
  );
}

function addHiddenParentContext(tasks: readonly Task[], allTasks: readonly Task[]): readonly Task[] {
  const taskByKey = new Map(allTasks.map((task) => [task.key, task]));
  const visibleKeys = new Set(tasks.map((task) => task.key));
  const emittedKeys = new Set<string>();
  const displayed: Task[] = [];

  for (const task of tasks) {
    if (emittedKeys.has(task.key)) continue;

    if (!task.parent || visibleKeys.has(task.parent)) {
      displayed.push(task);
      emittedKeys.add(task.key);
      continue;
    }

    const parent = taskByKey.get(task.parent);
    if (parent && !emittedKeys.has(parent.key)) {
      displayed.push(parent);
      emittedKeys.add(parent.key);
    }

    for (const sibling of tasks) {
      if (sibling.parent === task.parent && !emittedKeys.has(sibling.key)) {
        displayed.push(sibling);
        emittedKeys.add(sibling.key);
      }
    }
  }

  return displayed;
}
