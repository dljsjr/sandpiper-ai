#!/usr/bin/env node
import { Command } from '@commander-js/extra-typings';
import { cleanupCommand } from './commands/cleanup-cmd.js';
import { readCommand } from './commands/read-cmd.js';
import { writeCommand } from './commands/write-cmd.js';

const program = new Command()
  .name('sandpiper-standup')
  .description('Concurrent session stand-up management with PID-based liveness detection')
  .version('0.0.1')
  .option('-d, --dir <path>', 'Path to the directory containing .sandpiper/standup.md (defaults to cwd)');

program.addCommand(readCommand);
program.addCommand(writeCommand);
program.addCommand(cleanupCommand);

program.parse();
