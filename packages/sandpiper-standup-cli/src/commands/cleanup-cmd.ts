import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { Command } from '@commander-js/extra-typings';
import { getPidFilePath } from 'sandpiper-ai-core';
import { cleanupStandup } from '../core/cleanup.js';
import { getRootDir, resolveStandupCommandContext } from './helpers.js';

export const cleanupCommand = new Command('cleanup')
  .description('Clean up dead sessions from the standup file and report what was cleaned')
  .action((_opts, cmd) => {
    const context = resolveStandupCommandContext({
      rootDir: getRootDir(cmd as Command),
      cwd: process.cwd(),
      env: process.env,
    });

    if (!existsSync(context.standupPath)) {
      console.log('No standup file found.');
      return;
    }

    const content = readFileSync(context.standupPath, 'utf-8');
    const result = cleanupStandup(content, { currentSessionId: context.session.sessionId });

    // Write cleaned content back
    const tempPath = `${context.standupPath}.tmp`;
    writeFileSync(tempPath, result.serialized, 'utf-8');
    renameSync(tempPath, context.standupPath);

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
