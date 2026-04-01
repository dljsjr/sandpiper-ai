import { readFileSync } from 'node:fs';
import { Command } from '@commander-js/extra-typings';
import { editInEditor } from '../core/editor.js';
import { writeFileAtomic } from '../core/fs.js';
import { updateIndex } from '../core/index-update.js';
import { updateTaskFields } from '../core/mutate.js';
import { getTasksDir, resolveTaskPath, shouldSave, withErrorHandling } from './helpers.js';
import {
  applyInteractiveFieldUpdates,
  type BulkFilterOptions,
  buildFieldsFromOptions,
  emitMutationOutput,
  resolveTargetPaths,
  type UpdateOptions,
} from './task-cmd-helpers.js';

interface UpdateCommandOptions extends UpdateOptions, BulkFilterOptions {
  readonly interactive?: boolean;
}

export const taskUpdateCommand = new Command('update')
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
  .action((key, opts: UpdateCommandOptions, cmd) => {
    withErrorHandling(() => {
      const tasksDir = getTasksDir(cmd);
      const fields = buildFieldsFromOptions(opts);

      if (opts.interactive) {
        if (!key) {
          throw new Error('--interactive requires a task key.');
        }

        const taskKey = key.toUpperCase();
        const taskPath = resolveTaskPath(tasksDir, taskKey);
        const content = readFileSync(taskPath, 'utf-8');
        const edited = editInEditor(applyInteractiveFieldUpdates(content, fields), `${taskKey}.md`);

        if (edited === null) {
          console.log('No changes made.');
          return;
        }

        writeFileAtomic(taskPath, edited);
        updateIndex(tasksDir);
        console.log(`Updated ${taskKey} via editor.`);
        return;
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
