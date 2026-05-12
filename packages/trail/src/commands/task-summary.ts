import { Command } from '@commander-js/extra-typings';
import { formatSummary } from '../core/format.js';
import { queryTasks } from '../core/query.js';
import { loadTasks, withErrorHandling } from './helpers.js';
import { searchFilterToTaskFilter } from './task-cmd-helpers.js';

export const taskSummaryCommand = new Command('summary')
  .description('Show a status/priority breakdown of tasks')
  .option('-p, --project <key>', 'Filter by project key')
  .option('-q, --search <text>', 'Full-text search in task files (uses ripgrep)')
  .action((opts, cmd) => {
    withErrorHandling(() => {
      const tasks = loadTasks(cmd);
      const filter = searchFilterToTaskFilter(cmd, opts);
      const filtered = queryTasks(tasks, filter);
      console.log(formatSummary(filtered));
    });
  });
