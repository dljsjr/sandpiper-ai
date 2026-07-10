import { existsSync, readFileSync } from 'node:fs';
import { Command } from '@commander-js/extra-typings';
import { cleanupStandup } from '../core/cleanup.js';
import { getRootDir, resolveStandupCommandContext } from './helpers.js';

export const readCommand = new Command('read')
  .description('Read the standup file, outputting active and inactive sections')
  .action((_opts, cmd) => {
    const context = resolveStandupCommandContext({
      rootDir: getRootDir(cmd as Command),
      cwd: process.cwd(),
      env: process.env,
    });

    if (!existsSync(context.standupPath)) {
      process.exitCode = 1;
      return;
    }

    const content = readFileSync(context.standupPath, 'utf-8');
    // Classify sections for display only — read never deletes anything. A dead
    // pidfile just means "not this session," not "abandoned"; only an explicit
    // `cleanup` call may prune a section, since the owning thread may be
    // intentionally dormant for an arbitrarily long time before it's picked up.
    const result = cleanupStandup(content, { currentSessionId: context.session.sessionId });

    // Output with Active and Inactive sections
    const output: string[] = ['# Session Stand-Up'];

    if (result.cleanedSections.length > 0) {
      output.push('', '## Active Sessions', '');
      for (const section of result.cleanedSections) {
        output.push(`### ${section.id} (Updated: ${section.updated})`);
        output.push('');
        output.push(`Session file: ${section.sessionFile}`);
        output.push('');
        output.push(section.body);
        output.push('');
      }
    }

    if (result.inactiveSections.length > 0) {
      output.push('', '## Inactive Sessions', '');
      for (const section of result.inactiveSections) {
        output.push(`### ${section.id} (Updated: ${section.updated})`);
        output.push('');
        output.push(`Session file: ${section.sessionFile}`);
        output.push('');
        output.push(section.body);
        output.push('');
      }
    }

    console.log(output.join('\n'));
  });
