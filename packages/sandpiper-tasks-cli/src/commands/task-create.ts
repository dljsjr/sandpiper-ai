import { Command } from '@commander-js/extra-typings';
import { parseFrontmatter } from '../core/frontmatter.js';
import { createTask, renderTaskContent } from '../core/mutate.js';
import type { TaskKind, TaskPriority, TaskReporter } from '../core/types.js';
import { emitMutationResult, getOutputFormat, getTasksDir, shouldSave, withErrorHandling } from './helpers.js';

export const taskCreateCommand = new Command('create')
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
        const format = getOutputFormat(cmd);
        const content = renderTaskContent(createOpts);
        if (format === 'json') {
          console.log(JSON.stringify([parseFrontmatter(content)], null, 2));
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
