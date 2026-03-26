import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { Command } from '@commander-js/extra-typings';
import { archiveCompletedTasks, listArchivedTasks } from '../core/archive.js';
import { replaceDescription } from '../core/description.js';
import { editInEditor } from '../core/editor.js';
import { formatSummary, formatTaskDetail, formatTaskLine } from '../core/format.js';
import { parseFrontmatter, taskFromFrontmatter } from '../core/frontmatter.js';
import { updateIndex } from '../core/index-update.js';
import { moveTask } from '../core/move.js';
import {
  applyFieldUpdates,
  completeTask,
  createTask,
  pickupTask,
  renderTaskContent,
  updateTaskFields,
} from '../core/mutate.js';
import { formatRawOutput, formatTasksOutput } from '../core/output.js';
import type { TaskFilter } from '../core/query.js';
import { getSubtasks, getTask, queryTasks } from '../core/query.js';
import type { TaskAssignee, TaskKind, TaskPriority, TaskReporter, TaskResolution, TaskStatus } from '../core/types.js';
import {
  emitMutationResult,
  getOutputFormat,
  getTasksDir,
  loadTasks,
  resolveTaskPath,
  searchToKeys,
  shouldSave,
  withErrorHandling,
} from './helpers.js';

/**
 * Normalize status input — accept underscores or spaces, case insensitive.
 */
function normalizeStatus(input: string): TaskStatus {
  const normalized = input.toUpperCase().replace(/_/g, ' ');
  const valid = ['NOT STARTED', 'IN PROGRESS', 'NEEDS REVIEW', 'COMPLETE'];
  if (!valid.includes(normalized)) {
    throw new Error(`Invalid status: "${input}". Valid values: ${valid.join(', ')}`);
  }
  return normalized as TaskStatus;
}

const listCommand = new Command('list')
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
      const keys = searchToKeys(cmd, opts.search, {
        project: opts.project,
        parent: opts.parent,
      });

      const filter: TaskFilter = {
        ...(opts.project ? { project: opts.project } : {}),
        ...(opts.status ? { status: normalizeStatus(opts.status) } : {}),
        ...(opts.kind ? { kind: opts.kind.toUpperCase() as TaskKind } : {}),
        ...(opts.priority
          ? {
              priority: opts.priority.toUpperCase() as TaskPriority,
            }
          : {}),
        ...(opts.assignee
          ? {
              assignee: opts.assignee.toUpperCase() as TaskAssignee,
            }
          : {}),
        ...(opts.parent ? { parent: opts.parent } : {}),
        ...(opts.topLevel ? { isSubtask: false } : {}),
        ...(opts.subtasksOnly ? { isSubtask: true } : {}),
        ...(keys ? { keys } : {}),
      };

      const sortField = (opts.sort ?? 'priority') as 'key' | 'priority' | 'status' | 'createdAt' | 'updatedAt';
      const result = queryTasks(tasks, filter, {
        sort: {
          field: sortField,
          order: opts.desc ? 'desc' : 'asc',
        },
        limit: opts.limit ? Number.parseInt(opts.limit, 10) : undefined,
      });

      const fmt = getOutputFormat(cmd);
      if (fmt && fmt !== 'raw') {
        console.log(formatTasksOutput(result, fmt));
      } else if (fmt === 'raw') {
        const files = result.map((t) => {
          const p = resolveTaskPath(getTasksDir(cmd), t.key);
          return { path: p, content: readFileSync(p, 'utf-8') };
        });
        console.log(formatRawOutput(files));
      } else {
        if (result.length === 0) {
          console.log('No tasks found matching the given filters.');
          return;
        }
        for (const task of result) {
          console.log(formatTaskLine(task));
        }
        console.log(`\n${result.length} task${result.length !== 1 ? 's' : ''}`);
      }
    });
  });

const showCommand = new Command('show')
  .description('Show details for a specific task')
  .argument('<key>', 'Task key (e.g., SHR-1)')
  .action((key, _opts, cmd) => {
    withErrorHandling(() => {
      const tasks = loadTasks(cmd);
      const task = getTask(tasks, key.toUpperCase());

      if (!task) {
        console.error(`Task not found: ${key}`);
        process.exitCode = 1;
        return;
      }

      const fmt = getOutputFormat(cmd);
      if (fmt && fmt !== 'raw') {
        const subtasks = getSubtasks(tasks, task.key);
        console.log(formatTasksOutput([task, ...subtasks], fmt));
      } else if (fmt === 'raw') {
        const p = resolveTaskPath(getTasksDir(cmd), task.key);
        console.log(readFileSync(p, 'utf-8'));
      } else {
        console.log(formatTaskDetail(task));
        const subtasks = getSubtasks(tasks, task.key);
        if (subtasks.length > 0) {
          console.log(`\nSubtasks (${subtasks.length}):`);
          for (const sub of subtasks) {
            console.log(formatTaskLine(sub));
          }
        }
      }
    });
  });

const summaryCommand = new Command('summary')
  .description('Show a status/priority breakdown of tasks')
  .option('-p, --project <key>', 'Filter by project key')
  .option('-q, --search <text>', 'Full-text search in task files (uses ripgrep)')
  .action((opts, cmd) => {
    withErrorHandling(() => {
      const tasks = loadTasks(cmd);
      const keys = searchToKeys(cmd, opts.search, {
        project: opts.project,
      });
      const filter: TaskFilter = {
        ...(opts.project ? { project: opts.project } : {}),
        ...(keys ? { keys } : {}),
      };
      const filtered = queryTasks(tasks, filter);
      console.log(formatSummary(filtered));
    });
  });

const createCommand = new Command('create')
  .description('Create a new task, bug, or subtask')
  .requiredOption('-p, --project <key>', 'Project key (e.g., SHR)')
  .requiredOption('-t, --title <title>', 'Task title')
  .option('-k, --kind <kind>', 'Kind: TASK, BUG, SUBTASK', 'TASK')
  .option('--priority <priority>', 'Priority: LOW, MEDIUM, HIGH', 'MEDIUM')
  .option('--reporter <reporter>', 'Reporter: USER, AGENT', 'USER')
  .option('--parent <key>', 'Parent task key (required for SUBTASK)')
  .option('--depends-on <keys>', 'Comma-separated task keys this depends on')
  .option('--blocked-by <keys>', 'Comma-separated task keys blocking this')
  .option('--related <keys>', 'Comma-separated related task keys')
  .action((opts, cmd) => {
    withErrorHandling(() => {
      const createOpts = {
        project: opts.project.toUpperCase(),
        kind: opts.kind.toUpperCase() as TaskKind,
        priority: opts.priority.toUpperCase() as TaskPriority,
        title: opts.title,
        reporter: opts.reporter.toUpperCase() as TaskReporter,
        parent: opts.parent,
        dependsOn: opts.dependsOn?.split(',').map((s: string) => s.trim()),
        blockedBy: opts.blockedBy?.split(',').map((s: string) => s.trim()),
        related: opts.related?.split(',').map((s: string) => s.trim()),
      };

      if (!shouldSave(cmd)) {
        // --no-save: render content to stdout without writing
        const fmt = getOutputFormat(cmd);
        const content = renderTaskContent(createOpts);
        if (fmt === 'json') {
          const fm = parseFrontmatter(content);
          console.log(JSON.stringify([fm], null, 2));
        } else {
          console.log(content);
        }
        return;
      }

      const tasksDir = getTasksDir(cmd);
      const result = createTask(tasksDir, createOpts);
      emitMutationResult(cmd, [result.path], `Created ${result.key}: ${opts.title}\n  File: ${result.path}`);
    });
  });

const updateCommand = new Command('update')
  .description('Update fields on one or more tasks')
  .argument('[key]', 'Task key to update (or use filters for bulk)')
  .option('-s, --status <status>', 'Set status')
  .option('-a, --assignee <assignee>', 'Set assignee')
  .option('--priority <priority>', 'Set priority')
  .option('--resolution <resolution>', 'Set resolution: DONE or WONTFIX')
  .option('-t, --title <title>', 'Set title')
  .option('--reporter <reporter>', 'Set reporter: USER or AGENT')
  .option('--depends-on <keys>', 'Set depends_on (comma-separated keys, or empty string to clear)')
  .option('--blocked-by <keys>', 'Set blocked_by (comma-separated keys, or empty string to clear)')
  .option('--related <keys>', 'Set related (comma-separated keys, or empty string to clear)')
  .option('--desc <text>', 'Set description (task body text)')
  .option('-i, --interactive', 'Open task in $EDITOR for editing')
  .option('-p, --project <key>', 'Filter by project (for bulk)')
  .option('--filter-status <status>', 'Filter by current status (for bulk)')
  .option('-q, --search <text>', 'Full-text search filter (for bulk)')
  .action((key, opts, cmd) => {
    withErrorHandling(() => {
      const tasksDir = getTasksDir(cmd);

      // Interactive mode: open in $EDITOR
      if (opts.interactive) {
        if (!key) {
          throw new Error('--interactive requires a task key.');
        }
        const taskPath = resolveTaskPath(tasksDir, key.toUpperCase());

        // Build fields from any flags provided alongside --interactive
        const fields: Record<string, unknown> = {};
        if (opts.status) fields.status = normalizeStatus(opts.status);
        if (opts.assignee) fields.assignee = opts.assignee.toUpperCase();
        if (opts.priority) fields.priority = opts.priority.toUpperCase();
        if (opts.resolution) fields.resolution = opts.resolution.toUpperCase();
        if (opts.title) fields.title = opts.title;
        if (opts.reporter) fields.reporter = opts.reporter.toUpperCase();
        if (opts.desc) fields.description = opts.desc;

        // Apply any flag-based updates to get the starting content
        let content = readFileSync(taskPath, 'utf-8');
        if (Object.keys(fields).length > 0) {
          content = applyFieldUpdates(content, fields);
          if (fields.description !== undefined) {
            content = replaceDescription(content, fields.description as string);
          }
        }

        // Open in editor
        const taskKey = key.toUpperCase();
        const edited = editInEditor(content, `${taskKey}.md`);

        if (edited === null) {
          console.log('No changes made.');
          return;
        }

        // Write the edited content back
        writeFileSync(taskPath, edited);
        updateIndex(tasksDir);
        console.log(`Updated ${taskKey} via editor.`);
        return;
      }

      const fields: Record<string, unknown> = {};
      if (opts.status) fields.status = normalizeStatus(opts.status);
      if (opts.assignee) fields.assignee = opts.assignee.toUpperCase();
      if (opts.priority) fields.priority = opts.priority.toUpperCase();
      if (opts.resolution) fields.resolution = opts.resolution.toUpperCase();
      if (opts.title) fields.title = opts.title;
      if (opts.reporter) fields.reporter = opts.reporter.toUpperCase();
      if (opts.desc) fields.description = opts.desc;
      if (opts.dependsOn !== undefined) {
        fields.dependsOn = opts.dependsOn ? opts.dependsOn.split(',').map((s: string) => s.trim()) : [];
      }
      if (opts.blockedBy !== undefined) {
        fields.blockedBy = opts.blockedBy ? opts.blockedBy.split(',').map((s: string) => s.trim()) : [];
      }
      if (opts.related !== undefined) {
        fields.related = opts.related ? opts.related.split(',').map((s: string) => s.trim()) : [];
      }

      if (Object.keys(fields).length === 0) {
        console.error(
          'No fields to update. Use --status, --assignee, --priority, --title, --reporter, --resolution, --desc, --depends-on, --blocked-by, --related, or use --interactive to edit in $EDITOR.',
        );
        process.exitCode = 1;
        return;
      }

      const paths = resolveTargetPaths(key, opts, cmd, tasksDir);
      if (shouldSave(cmd)) {
        for (const path of paths) {
          updateTaskFields(path, fields);
        }
      }
      emitMutationOutput(cmd, paths, fields, `Updated ${paths.length} task${paths.length !== 1 ? 's' : ''}.`);
    });
  });

const pickupCommand = new Command('pickup')
  .description('Pick up task(s) — set assignee=AGENT, status=IN PROGRESS')
  .argument('[key]', 'Task key (or use filters for bulk)')
  .option('-p, --project <key>', 'Filter by project (for bulk)')
  .option('--filter-status <status>', 'Filter by current status (for bulk)')
  .option('-q, --search <text>', 'Full-text search filter (for bulk)')
  .action((key, opts, cmd) => {
    withErrorHandling(() => {
      const tasksDir = getTasksDir(cmd);
      const fields = {
        status: 'IN PROGRESS' as const,
        assignee: 'AGENT' as const,
      };

      if (shouldSave(cmd)) {
        const paths = resolveTargetPaths(key, opts, cmd, tasksDir);
        for (const path of paths) {
          pickupTask(path);
        }
        emitMutationResult(cmd, paths, `Picked up ${paths.length} task${paths.length !== 1 ? 's' : ''}.`);
      } else {
        const paths = resolveTargetPaths(key, opts, cmd, tasksDir);
        emitMutationOutput(cmd, paths, fields, `Picked up ${paths.length} task${paths.length !== 1 ? 's' : ''}.`);
      }
    });
  });

const completeCommand = new Command('complete')
  .description('Complete task(s) — set status to NEEDS REVIEW (or COMPLETE with --final --resolution DONE|WONTFIX)')
  .argument('[key]', 'Task key (or use filters for bulk)')
  .option('--final', 'Set status to COMPLETE instead of NEEDS REVIEW')
  .option('--resolution <resolution>', 'Resolution: DONE or WONTFIX (required with --final)')
  .option('-p, --project <key>', 'Filter by project (for bulk)')
  .option('--filter-status <status>', 'Filter by current status (for bulk)')
  .option('-q, --search <text>', 'Full-text search filter (for bulk)')
  .action((key, opts, cmd) => {
    withErrorHandling(() => {
      const tasksDir = getTasksDir(cmd);
      const targetStatus = opts.final ? 'COMPLETE' : 'NEEDS REVIEW';

      if (opts.final && !opts.resolution) {
        throw new Error('--final requires --resolution DONE or --resolution WONTFIX.');
      }

      const resolution = opts.resolution?.toUpperCase() as TaskResolution | undefined;
      const fields = {
        status: targetStatus as TaskStatus,
        ...(resolution ? { resolution } : {}),
      };

      if (shouldSave(cmd)) {
        const paths = resolveTargetPaths(key, opts, cmd, tasksDir);
        for (const path of paths) {
          completeTask(path, opts.final ?? false, resolution);
        }
        emitMutationResult(
          cmd,
          paths,
          `Completed ${paths.length} task${paths.length !== 1 ? 's' : ''} → ${targetStatus}.`,
        );
      } else {
        const paths = resolveTargetPaths(key, opts, cmd, tasksDir);
        emitMutationOutput(
          cmd,
          paths,
          fields,
          `Completed ${paths.length} task${paths.length !== 1 ? 's' : ''} → ${targetStatus}.`,
        );
      }
    });
  });

/**
 * Output mutation results — either from already-written files (shouldSave=true)
 * or by applying changes in-memory (shouldSave=false / --no-save).
 */
function emitMutationOutput(
  // biome-ignore lint/suspicious/noExplicitAny: Commander generic params vary
  cmd: Command<any, any, any>,
  paths: readonly string[],
  fields: Record<string, unknown>,
  humanMessage: string,
): void {
  if (shouldSave(cmd)) {
    emitMutationResult(cmd, paths, humanMessage);
    return;
  }

  // --no-save: apply in-memory and output
  const fmt = getOutputFormat(cmd);

  const modified = paths.map((p) => ({
    path: p,
    content: applyFieldUpdates(readFileSync(p, 'utf-8'), fields),
  }));

  if (fmt === 'json' || fmt === 'toon') {
    const tasks = modified.map((m) => taskFromFrontmatter(basename(m.path, '.md'), parseFrontmatter(m.content)));
    console.log(formatTasksOutput(tasks, fmt));
  } else {
    console.log(formatRawOutput(modified));
  }
}

/**
 * Resolve target task file paths from either a direct key or filter options.
 * Used by update, pickup, and complete for single-key or bulk operations.
 */
function resolveTargetPaths(
  key: string | undefined,
  opts: { project?: string; filterStatus?: string; search?: string },
  // biome-ignore lint/suspicious/noExplicitAny: Commander generic params vary
  cmd: Command<any, any, any>,
  tasksDir: string,
): string[] {
  if (key) {
    return [resolveTaskPath(tasksDir, key.toUpperCase())];
  }

  // Bulk mode: use filters to find matching tasks
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

  return matched.map((t) => resolveTaskPath(tasksDir, t.key));
}

const moveCommand = new Command('move')
  .description('Move task between projects, change kind (TASK↔BUG↔SUBTASK), or reparent')
  .argument('<key>', 'Task key to move')
  .option('-p, --project <key>', 'Target project (triggers re-key)')
  .option('-k, --kind <kind>', 'New kind: TASK, BUG, SUBTASK')
  .option('--parent <key>', 'New parent (required when kind is SUBTASK)')
  .action((key, opts, cmd) => {
    withErrorHandling(() => {
      const tasksDir = getTasksDir(cmd);

      if (!opts.project && !opts.kind && !opts.parent) {
        throw new Error('Nothing to move. Use --project, --kind, or --parent.');
      }

      const result = moveTask(tasksDir, key.toUpperCase(), {
        project: opts.project?.toUpperCase(),
        kind: opts.kind?.toUpperCase() as TaskKind | undefined,
        parent: opts.parent?.toUpperCase(),
      });

      updateIndex(tasksDir);

      const parts = [`Moved ${result.oldKey}`];
      if (result.oldKey !== result.newKey) {
        parts.push(`→ ${result.newKey}`);
      }
      if (result.reKeyMap.size > 1) {
        parts.push(`(${result.reKeyMap.size} tasks re-keyed)`);
      }
      console.log(parts.join(' '));

      if (result.reKeyMap.size > 0) {
        for (const [oldK, newK] of result.reKeyMap) {
          if (oldK !== result.oldKey) {
            console.log(`  ${oldK} → ${newK}`);
          }
        }
      }
    });
  });

const archiveCommand = new Command('archive')
  .description('Move completed tasks to archive/ subdirectory within their project')
  .option('-p, --project <key>', 'Archive only tasks in this project')
  .option('--list', 'List archived tasks instead of archiving')
  .action((opts, cmd) => {
    withErrorHandling(() => {
      const tasksDir = getTasksDir(cmd);

      if (opts.list) {
        const keys = listArchivedTasks(tasksDir, opts.project?.toUpperCase());
        if (keys.length === 0) {
          console.log('No archived tasks found.');
        } else {
          console.log(`Archived tasks (${keys.length}):`);
          for (const key of keys) {
            console.log(`  ${key}`);
          }
        }
        return;
      }

      if (!shouldSave(cmd)) {
        // Dry run: show what would be archived without moving files
        const tasks = loadTasks(cmd);
        const filter: TaskFilter = {
          status: 'COMPLETE' as TaskStatus,
          ...(opts.project ? { project: opts.project.toUpperCase() } : {}),
        };
        const completed = queryTasks(tasks, filter);
        // Only top-level tasks (not subtasks) get archived directly
        const topLevel = completed.filter((t) => !t.parent);
        if (topLevel.length === 0) {
          console.log('No completed tasks to archive.');
        } else {
          console.log(`Would archive ${topLevel.length} task${topLevel.length !== 1 ? 's' : ''}:`);
          for (const t of topLevel) {
            console.log(`  ${t.key}`);
          }
        }
        return;
      }

      const result = archiveCompletedTasks(tasksDir, opts.project?.toUpperCase());

      if (result.archived.length === 0) {
        console.log('No completed tasks to archive.');
        return;
      }

      // Rebuild the index after archiving to remove archived tasks
      updateIndex(tasksDir);

      console.log(`Archived ${result.archived.length} task${result.archived.length !== 1 ? 's' : ''}:`);
      for (const key of result.archived) {
        console.log(`  ${key}`);
      }
    });
  });

export const taskCommand = new Command('task')
  .description('Query and inspect tasks')
  .addCommand(listCommand)
  .addCommand(showCommand)
  .addCommand(summaryCommand)
  .addCommand(createCommand)
  .addCommand(updateCommand)
  .addCommand(pickupCommand)
  .addCommand(completeCommand)
  .addCommand(moveCommand)
  .addCommand(archiveCommand);
