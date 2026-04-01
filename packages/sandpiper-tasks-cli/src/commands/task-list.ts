import { readFileSync } from 'node:fs';
import { Command } from '@commander-js/extra-typings';
import { formatTaskLine } from '../core/format.js';
import { formatRawOutput, formatTasksOutput } from '../core/output.js';
import type { TaskFilter } from '../core/query.js';
import { queryTasks } from '../core/query.js';
import type { TaskAssignee, TaskKind, TaskPriority } from '../core/types.js';
import { getOutputFormat, getTasksDir, loadTasks, resolveTaskPath, withErrorHandling } from './helpers.js';
import { normalizeStatus, searchFilterToTaskFilter } from './task-cmd-helpers.js';

export const taskListCommand = new Command('list')
  .description('List tasks with optional filters')
  .option('-p, --project <key>', 'Filter by project key')
  .option('-s, --status <status>', 'Filter by status (NOT_STARTED, IN_PROGRESS, NEEDS_REVIEW, COMPLETE)')
  .option('-k, --kind <kind>', 'Filter by kind (TASK, BUG, SUBTASK)')
  .option('--priority <priority>', 'Filter by priority (LOW, MEDIUM, HIGH)')
  .option('-a, --assignee <assignee>', 'Filter by assignee (UNASSIGNED, USER, AGENT)')
  .option('--parent <key>', 'Filter subtasks of a specific parent')
  .option('--top-level', 'Show only top-level tasks (no subtasks)')
  .option('--subtasks-only', 'Show only subtasks')
  .option('--sort <field>', 'Sort by field (key, priority, status, createdAt, updatedAt)', 'priority')
  .option('--desc', 'Sort descending')
  .option('--limit <n>', 'Limit number of results')
  .option('-q, --search <text>', 'Full-text search in task files (uses ripgrep)')
  .action((opts, cmd) => {
    withErrorHandling(() => {
      const tasks = loadTasks(cmd);
      const baseFilter = searchFilterToTaskFilter(cmd, opts);
      const filter: TaskFilter = {
        ...baseFilter,
        ...(opts.status ? { status: normalizeStatus(opts.status) } : {}),
        ...(opts.kind ? { kind: opts.kind.toUpperCase() as TaskKind } : {}),
        ...(opts.priority ? { priority: opts.priority.toUpperCase() as TaskPriority } : {}),
        ...(opts.assignee ? { assignee: opts.assignee.toUpperCase() as TaskAssignee } : {}),
        ...(opts.parent ? { parent: opts.parent } : {}),
        ...(opts.topLevel ? { isSubtask: false } : {}),
        ...(opts.subtasksOnly ? { isSubtask: true } : {}),
      };

      const sortField = (opts.sort ?? 'priority') as 'key' | 'priority' | 'status' | 'createdAt' | 'updatedAt';
      const result = queryTasks(tasks, filter, {
        sort: {
          field: sortField,
          order: opts.desc ? 'desc' : 'asc',
        },
        limit: opts.limit ? Number.parseInt(opts.limit, 10) : undefined,
      });

      const format = getOutputFormat(cmd);
      if (format && format !== 'raw') {
        console.log(formatTasksOutput(result, format));
        return;
      }

      if (format === 'raw') {
        const files = result.map((task) => {
          const path = resolveTaskPath(getTasksDir(cmd), task.key);
          return { path, content: readFileSync(path, 'utf-8') };
        });
        console.log(formatRawOutput(files));
        return;
      }

      if (result.length === 0) {
        console.log('No tasks found matching the given filters.');
        return;
      }

      for (const task of result) {
        console.log(formatTaskLine(task));
      }
      console.log(`\n${result.length} task${result.length !== 1 ? 's' : ''}`);
    });
  });
