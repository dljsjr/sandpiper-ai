import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from '@commander-js/extra-typings';
import { getPidFilePath } from 'sandpiper-ai-core';
import { cleanupStandup } from '../core/cleanup.js';
import { getRootDir } from './helpers.js';

export const cleanupCommand = new Command('cleanup')
  .description('Clean up dead sessions from the standup file and report what was cleaned')
  .action((_opts, cmd) => {
    const cwd = getRootDir(cmd as Command) || process.cwd();
    const standupPath = join(cwd, '.sandpiper', 'standup.md');

    if (!existsSync(standupPath)) {
      console.log('No standup file found.');
      return;
    }

    const content = readFileSync(standupPath, 'utf-8');
    const sessionId = process.env.SANDPIPER_SESSION_ID;
    const result = cleanupStandup(content, { currentSessionId: sessionId });

    // Write cleaned content back
    const tempPath = `${standupPath}.tmp`;
    writeFileSync(tempPath, result.serialized, 'utf-8');
    renameSync(tempPath, standupPath);

    // Report what was cleaned and clean up PID files
    if (result.inactiveSections.length > 0) {
      console.log('Cleaned inactive sessions:');
      for (const section of result.inactiveSections) {
        console.log(`  - ${section.uuid} (Updated: ${section.updated})`);

        // Clean up the PID file if it exists
        const pidFilePath = getPidFilePath(section.uuid);
        if (existsSync(pidFilePath)) {
          rmSync(pidFilePath);
          console.log(`    Removed PID file: ${pidFilePath}`);
        }
      }
    } else {
      console.log('No inactive sessions to clean.');
    }
  });
