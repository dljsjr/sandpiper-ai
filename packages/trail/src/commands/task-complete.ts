import { Command } from '@commander-js/extra-typings';
import { completeTask } from '../core/mutate.js';
import type { TaskResolution } from '../core/types.js';
import { emitMutationResult, getTasksDir, withErrorHandling } from './helpers.js';
import { type BulkFilterOptions, resolveTargetPaths } from './task-cmd-helpers.js';

interface CompleteCommandOptions extends BulkFilterOptions {
  readonly final?: boolean;
  readonly resolution?: string;
}

export const taskCompleteCommand = new Command('complete')
  .description('Complete task(s) — set status to NEEDS REVIEW (or COMPLETE with --final --resolution DONE|WONTFIX)')
  .argument('[key]', 'Task key (or use filters for bulk)')
  .option('--final', 'Set status to COMPLETE instead of NEEDS REVIEW')
  .option('--resolution <resolution>', 'Resolution: DONE or WONTFIX (required with --final)')
  .option('-p, --project <key>', 'Filter by project (for bulk)')
  .option('--filter-status <status>', 'Filter by current status (for bulk)')
  .option('-q, --search <text>', 'Full-text search filter (for bulk)')
  .option('--regex', 'Use JavaScript regex search (or ripgrep regex search with --ripgrep)')
  .option('--ripgrep', 'Use ripgrep search instead of the built-in search backend')
  .option('--bulk', 'Confirm intent for keyless bulk mutation')
  .action((key, opts: CompleteCommandOptions, cmd) => {
    withErrorHandling(() => {
      const targetStatus = opts.final ? 'COMPLETE' : 'NEEDS REVIEW';
      if (opts.final && !opts.resolution) {
        throw new Error('--final requires --resolution DONE or --resolution WONTFIX.');
      }

      const tasksDir = getTasksDir(cmd);
      const resolution = opts.resolution?.toUpperCase() as TaskResolution | undefined;
      const paths = resolveTargetPaths(key, opts, cmd, tasksDir, 'Task completion');
      for (const path of paths) {
        completeTask(path, tasksDir, opts.final ?? false, resolution);
      }
      emitMutationResult(
        cmd,
        paths,
        `Completed ${paths.length} task${paths.length !== 1 ? 's' : ''} → ${targetStatus}.`,
      );
    });
  });
