import { Command } from '@commander-js/extra-typings';
import { pickupTask } from '../core/mutate.js';
import { emitMutationResult, getTasksDir, shouldSave, withErrorHandling } from './helpers.js';
import { type BulkFilterOptions, emitMutationOutput, resolveTargetPaths } from './task-cmd-helpers.js';

export const taskPickupCommand = new Command('pickup')
  .description('Pick up task(s) — set assignee=AGENT, status=IN PROGRESS')
  .argument('[key]', 'Task key (or use filters for bulk)')
  .option('-p, --project <key>', 'Filter by project (for bulk)')
  .option('--filter-status <status>', 'Filter by current status (for bulk)')
  .option('-q, --search <text>', 'Full-text search filter (for bulk)')
  .action((key, opts: BulkFilterOptions, cmd) => {
    withErrorHandling(() => {
      const tasksDir = getTasksDir(cmd);
      const fields = {
        status: 'IN PROGRESS' as const,
        assignee: 'AGENT' as const,
      };

      const paths = resolveTargetPaths(key, opts, cmd, tasksDir);
      if (shouldSave(cmd)) {
        for (const path of paths) {
          pickupTask(path);
        }
        emitMutationResult(cmd, paths, `Picked up ${paths.length} task${paths.length !== 1 ? 's' : ''}.`);
        return;
      }

      emitMutationOutput(cmd, paths, fields, `Picked up ${paths.length} task${paths.length !== 1 ? 's' : ''}.`);
    });
  });
