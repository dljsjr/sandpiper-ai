import { Command } from '@commander-js/extra-typings';
import { completeTask } from '../core/mutate.js';
import type { TaskResolution, TaskStatus } from '../core/types.js';
import { emitMutationResult, getTasksDir, shouldSave, withErrorHandling } from './helpers.js';
import { type BulkFilterOptions, emitMutationOutput, resolveTargetPaths } from './task-cmd-helpers.js';

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
  .action((key, opts: CompleteCommandOptions, cmd) => {
    withErrorHandling(() => {
      const targetStatus = opts.final ? 'COMPLETE' : 'NEEDS REVIEW';
      if (opts.final && !opts.resolution) {
        throw new Error('--final requires --resolution DONE or --resolution WONTFIX.');
      }

      const tasksDir = getTasksDir(cmd);
      const resolution = opts.resolution?.toUpperCase() as TaskResolution | undefined;
      const fields = {
        status: targetStatus as TaskStatus,
        ...(resolution ? { resolution } : {}),
      };

      const paths = resolveTargetPaths(key, opts, cmd, tasksDir);
      if (shouldSave(cmd)) {
        for (const path of paths) {
          completeTask(path, opts.final ?? false, resolution);
        }
        emitMutationResult(
          cmd,
          paths,
          `Completed ${paths.length} task${paths.length !== 1 ? 's' : ''} → ${targetStatus}.`,
        );
        return;
      }

      emitMutationOutput(
        cmd,
        paths,
        fields,
        `Completed ${paths.length} task${paths.length !== 1 ? 's' : ''} → ${targetStatus}.`,
      );
    });
  });
