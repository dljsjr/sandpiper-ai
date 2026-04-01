import { Command } from '@commander-js/extra-typings';
import { updateIndex } from '../core/index-update.js';
import { moveTask } from '../core/move.js';
import type { TaskKind } from '../core/types.js';
import { getTasksDir, withErrorHandling } from './helpers.js';

export const taskMoveCommand = new Command('move')
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
        for (const [oldKey, newKey] of result.reKeyMap) {
          if (oldKey !== result.oldKey) {
            console.log(`  ${oldKey} → ${newKey}`);
          }
        }
      }
    });
  });
