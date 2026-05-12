import { Command } from '@commander-js/extra-typings';
import { taskArchiveCommand } from './task-archive.js';
import { taskCompleteCommand } from './task-complete.js';
import { taskCreateCommand } from './task-create.js';
import { taskListCommand } from './task-list.js';
import { taskMoveCommand } from './task-move.js';
import { taskPickupCommand } from './task-pickup.js';
import { taskShowCommand } from './task-show.js';
import { taskSummaryCommand } from './task-summary.js';
import { taskUpdateCommand } from './task-update.js';

export const taskCommand = new Command('task')
  .description('Query and inspect tasks')
  .addCommand(taskListCommand)
  .addCommand(taskShowCommand)
  .addCommand(taskSummaryCommand)
  .addCommand(taskCreateCommand)
  .addCommand(taskUpdateCommand)
  .addCommand(taskPickupCommand)
  .addCommand(taskCompleteCommand)
  .addCommand(taskMoveCommand)
  .addCommand(taskArchiveCommand);
