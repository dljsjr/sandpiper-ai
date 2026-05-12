#!/usr/bin/env node
import { basename } from 'node:path';
import { Command } from '@commander-js/extra-typings';
import { indexCommand } from './commands/index-cmd.js';
import { projectCommand } from './commands/project-cmd.js';
import { storageCommand } from './commands/storage-cmd.js';
import { taskCommand } from './commands/task-cmd.js';

const invokedName = basename(process.argv[1] ?? '');
const commandName = invokedName === 'sandpiper-tasks' ? 'sandpiper-tasks' : 'trail';

const program = new Command()
  .name(commandName)
  .description('Trail: plaintext task management with Markdown files and YAML frontmatter')
  .version('0.0.1')
  .option('-d, --dir <path>', 'Path to the directory containing .sandpiper/tasks (defaults to cwd)')
  .option('-f, --format <format>', 'Output format: raw, json, toon')
  .option('--no-save', 'Skip writing to disk and index; output only (implies --format raw if no format set)');

program.addCommand(indexCommand);
program.addCommand(taskCommand);
program.addCommand(projectCommand);
program.addCommand(storageCommand);

program.parse();
