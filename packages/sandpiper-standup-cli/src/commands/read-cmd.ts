import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from '@commander-js/extra-typings';
import { cleanupStandup } from '../core/cleanup.js';
import { parseStandup, type StandupSection, serializeStandup } from '../core/parser.js';
import { getRootDir } from './helpers.js';

export const readCommand = new Command('read')
  .description('Read and clean the standup file, outputting active and inactive sections')
  .action((_opts, cmd) => {
    const cwd = getRootDir(cmd as Command) || process.cwd();
    const standupPath = join(cwd, '.sandpiper', 'standup.md');

    if (!existsSync(standupPath)) {
      process.exitCode = 1;
      return;
    }

    const content = readFileSync(standupPath, 'utf-8');
    const sessionId = process.env.SANDPIPER_SESSION_ID;
    const result = cleanupStandup(content, { currentSessionId: sessionId });

    const parsedContent = parseStandup(content);
    const isLegacyFormat =
      parsedContent.sections.length === 1 &&
      parsedContent.sections[0]?.uuid === 'unknown' &&
      !parsedContent.sections[0]?.sessionFile;

    // Preserve legacy content on read (mirror write behavior)
    // Avoid destructive rewrite of legacy standups during first read.
    let persistedSections: readonly StandupSection[] = result.cleanedSections;
    if (isLegacyFormat && result.inactiveSections.length > 0) {
      const legacyUnknown = result.inactiveSections.find((section) => section.uuid === 'unknown');
      persistedSections = legacyUnknown ? [legacyUnknown, ...result.cleanedSections] : result.cleanedSections;
    }

    // Rewrite the file atomically if non-legacy sections were cleaned.
    if (!isLegacyFormat) {
      const nextSerialized = serializeStandup(persistedSections);
      if (nextSerialized !== content) {
        const tempPath = `${standupPath}.tmp`;
        writeFileSync(tempPath, nextSerialized, 'utf-8');
        renameSync(tempPath, standupPath);
      }
    }

    // Output with Active and Inactive sections
    const output: string[] = ['# Session Stand-Up'];

    if (result.cleanedSections.length > 0) {
      output.push('', '## Active Sessions', '');
      for (const section of result.cleanedSections) {
        output.push(`### Session ${section.uuid} (Updated: ${section.updated})`);
        output.push('');
        output.push(`Session file: ${section.sessionFile}`);
        output.push('');
        output.push(section.body);
      }
    }

    if (result.inactiveSections.length > 0) {
      output.push('', '## Inactive Sessions', '');
      for (const section of result.inactiveSections) {
        output.push(`### Session ${section.uuid} (Updated: ${section.updated})`);
        output.push('');
        output.push(`Session file: ${section.sessionFile}`);
        output.push('');
        output.push(section.body);
      }
    }

    console.log(output.join('\n'));
  });
