import { Command } from '@commander-js/extra-typings';
import { normalizeAssigneeInput } from '../core/frontmatter.js';
import { pickupTask } from '../core/mutate.js';
import { emitMutationResult, getTasksDir, shouldSave, withErrorHandling } from './helpers.js';
import { type BulkFilterOptions, emitMutationOutput, resolveTargetPaths } from './task-cmd-helpers.js';

interface PickupOptions extends BulkFilterOptions {
  readonly assignee?: string;
}

export const taskPickupCommand = new Command('pickup')
  .description('Pick up task(s) — set status=IN PROGRESS and assign an owner')
  .argument('[key]', 'Task key (or use filters for bulk)')
  .option('-a, --assignee <assignee>', 'Assignee (freeform; defaults to AGENT)', 'AGENT')
  .option('-p, --project <key>', 'Filter by project (for bulk)')
  .option('--filter-status <status>', 'Filter by current status (for bulk)')
  .option('-q, --search <text>', 'Full-text search filter (for bulk)')
  .option('--regex', 'Use JavaScript regex search (or ripgrep regex search with --ripgrep)')
  .option('--ripgrep', 'Use ripgrep search instead of the built-in search backend')
  .action((key, opts: PickupOptions, cmd) => {
    withErrorHandling(() => {
      const tasksDir = getTasksDir(cmd);
      const fields = {
        status: 'IN PROGRESS' as const,
        assignee: normalizeAssigneeInput(opts.assignee ?? 'AGENT'),
      };

      const paths = resolveTargetPaths(key, opts, cmd, tasksDir, 'Task pickup');
      if (shouldSave(cmd)) {
        for (const path of paths) {
          pickupTask(path, fields.assignee);
        }
        emitMutationResult(cmd, paths, `Picked up ${paths.length} task${paths.length !== 1 ? 's' : ''}.`);
        return;
      }

      emitMutationOutput(cmd, paths, fields, `Picked up ${paths.length} task${paths.length !== 1 ? 's' : ''}.`);
    });
  });
