import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { Command } from '@commander-js/extra-typings';
import { cleanupStandup } from '../core/cleanup.js';
import { parseStandup, type StandupSection, serializeStandup } from '../core/parser.js';
import {
  formatMissingSessionFileMessage,
  formatMissingSessionIdMessage,
  formatSessionFileHelp,
  formatSessionIdHelp,
  getRootDir,
  resolveStandupCommandContext,
} from './helpers.js';

export const writeCommand = new Command('write')
  .description('Write a standup section (reads from stdin)')
  .option('-u, --uuid <uuid>', formatSessionIdHelp())
  .option('-f, --file <path>', formatSessionFileHelp())
  .option('-s, --session-file <path>', 'Path to file containing section body (if not provided, reads from stdin)')
  .action(async (opts, cmd) => {
    const context = resolveStandupCommandContext({
      rootDir: getRootDir(cmd as Command),
      cwd: process.cwd(),
      env: process.env,
      sessionId: opts.uuid,
      sessionFile: opts.file,
    });
    const { sessionId, sessionFile } = context.session;

    if (!sessionId) {
      console.error(formatMissingSessionIdMessage());
      process.exitCode = 1;
      return;
    }

    if (!sessionFile) {
      console.error(formatMissingSessionFileMessage());
      process.exitCode = 1;
      return;
    }

    // Read section body from file or stdin
    let body: string;
    if (opts.sessionFile) {
      if (!existsSync(opts.sessionFile)) {
        console.error(`Section file not found: ${opts.sessionFile}`);
        process.exitCode = 1;
        return;
      }
      body = readFileSync(opts.sessionFile, 'utf-8');
    } else {
      // Read from stdin
      const chunks: Buffer[] = [];
      const stdin = process.stdin;
      stdin.setEncoding('utf-8');

      for await (const chunk of stdin) {
        chunks.push(Buffer.from(chunk));
      }

      body = Buffer.concat(chunks).toString('utf-8');
    }

    // Read existing standup
    let existingContent = '';
    if (existsSync(context.standupPath)) {
      existingContent = readFileSync(context.standupPath, 'utf-8');
    }

    // Parse existing content (don't clean yet - we need to preserve legacy on first write)
    const parsed = parseStandup(existingContent);

    // Check if this is a legacy format file (single "unknown" section with no session file)
    const isLegacyFormat =
      parsed.sections.length === 1 && parsed.sections[0]?.uuid === 'unknown' && !parsed.sections[0]?.sessionFile;

    // Clean existing content
    const cleanupResult = cleanupStandup(existingContent, { currentSessionId: sessionId });

    // Create new section
    const now = new Date().toISOString();
    const newSection: StandupSection = {
      uuid: sessionId,
      updated: now,
      sessionFile,
      body: body.trim(),
    };

    // Check if section already exists and update it
    const existingSectionIndex = cleanupResult.cleanedSections.findIndex((s) => s.uuid === sessionId);

    let cleanedSections: StandupSection[];
    if (existingSectionIndex >= 0) {
      // Update existing section
      cleanedSections = [...cleanupResult.cleanedSections];
      cleanedSections[existingSectionIndex] = newSection;
    } else {
      // Add new section
      cleanedSections = [...cleanupResult.cleanedSections, newSection];
    }

    // On first write to a legacy format file, preserve the unknown legacy section.
    const preservedKeys = new Set<string>();
    if (isLegacyFormat && cleanupResult.inactiveSections.length > 0) {
      const legacyUnknown = cleanupResult.inactiveSections.find((section) => section.uuid === 'unknown');
      if (legacyUnknown) {
        const key = `${legacyUnknown.uuid}:${legacyUnknown.updated}`;
        preservedKeys.add(key);
        cleanedSections = [legacyUnknown, ...cleanedSections];
      }
    }

    // Serialize and write atomically
    const serialized = serializeStandup(cleanedSections);
    const tempPath = `${context.standupPath}.tmp`;
    writeFileSync(tempPath, serialized, 'utf-8');
    renameSync(tempPath, context.standupPath);

    // Output only sessions that were actually removed.
    const removedInactive = cleanupResult.inactiveSections.filter(
      (section) => !preservedKeys.has(`${section.uuid}:${section.updated}`),
    );

    if (removedInactive.length > 0) {
      console.error('Inactive sessions removed:');
      for (const section of removedInactive) {
        console.error(`  - ${section.uuid} (Updated: ${section.updated})`);
      }
    }
  });
