import { Command } from '@commander-js/extra-typings';
import { archiveCompletedTasks, listArchivedTasks } from '../core/archive.js';
import { updateIndex } from '../core/index-update.js';
import { getTasksDir, withErrorHandling } from './helpers.js';

export const taskArchiveCommand = new Command('archive')
  .description('Move completed tasks to archive/ subdirectory within their project')
  .option('-p, --project <key>', 'Archive only tasks in this project')
  .option('--list', 'List archived tasks instead of archiving')
  .action((opts, cmd) => {
    withErrorHandling(() => {
      const tasksDir = getTasksDir(cmd);
      const project = opts.project?.toUpperCase();

      if (opts.list) {
        const keys = listArchivedTasks(tasksDir, project);
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

      const result = archiveCompletedTasks(tasksDir, project);
      if (result.archived.length === 0) {
        console.log('No completed tasks to archive.');
        return;
      }

      updateIndex(tasksDir);

      console.log(`Archived ${result.archived.length} task${result.archived.length !== 1 ? 's' : ''}:`);
      for (const key of result.archived) {
        console.log(`  ${key}`);
      }
    });
  });
