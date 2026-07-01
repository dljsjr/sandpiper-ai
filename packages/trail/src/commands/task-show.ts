import { readFileSync } from 'node:fs';
import { Command } from '@commander-js/extra-typings';
import { extractDescription } from '../core/description.js';
import { formatTaskDetail, formatTaskLine } from '../core/format.js';
import { extractFrontmatter, formatTasksOutput } from '../core/output.js';
import { resolveTaskFile } from '../core/patterns.js';
import { getSubtasks, getTask } from '../core/query.js';
import { getOutputFormat, getTasksDir, loadTasks, withErrorHandling } from './helpers.js';

export const taskShowCommand = new Command('show')
  .description('Show details for a specific task')
  .argument('<key>', 'Task key (e.g., SHR-1)')
  .option('--metadata-only', 'Return only frontmatter fields; omit body and subtasks')
  .action((key, opts, cmd) => {
    withErrorHandling(() => {
      const tasks = loadTasks(cmd);
      const task = getTask(tasks, key.toUpperCase());
      if (!task) {
        console.error(`Task not found: ${key}`);
        process.exitCode = 1;
        return;
      }

      const readDescription = () =>
        extractDescription(readFileSync(resolveTaskFile(getTasksDir(cmd), task.key), 'utf-8')).trimEnd();

      const format = getOutputFormat(cmd);
      if (format && format !== 'raw') {
        const description = opts.metadataOnly ? undefined : readDescription();
        const primary = description ? { ...task, description } : task;
        const output = opts.metadataOnly ? [primary] : [primary, ...getSubtasks(tasks, task.key)];
        console.log(formatTasksOutput(output, format));
        return;
      }

      if (format === 'raw') {
        const path = resolveTaskFile(getTasksDir(cmd), task.key);
        const content = readFileSync(path, 'utf-8');
        console.log(opts.metadataOnly ? extractFrontmatter(content) : content);
        return;
      }

      console.log(formatTaskDetail(task, opts.metadataOnly ? undefined : readDescription()));
      if (opts.metadataOnly) {
        return;
      }

      const subtasks = getSubtasks(tasks, task.key);
      if (subtasks.length > 0) {
        console.log(`\nSubtasks (${subtasks.length}):`);
        for (const subtask of subtasks) {
          console.log(formatTaskLine(subtask));
        }
      }
    });
  });
