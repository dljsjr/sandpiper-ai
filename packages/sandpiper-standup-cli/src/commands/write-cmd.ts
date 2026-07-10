import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { Command } from '@commander-js/extra-typings';
import { parseStandup, type StandupSection, serializeStandup } from '../core/parser.js';
import {
  formatMissingSessionIdMessage,
  formatSessionFileHelp,
  formatSessionIdHelp,
  getRootDir,
  resolveStandupCommandContext,
} from './helpers.js';

export const writeCommand = new Command('write')
  .description('Write a standup section (reads from stdin)')
  .option('-i, --id <id>', formatSessionIdHelp())
  .option('-f, --file <path>', formatSessionFileHelp())
  .option(
    '-p, --pid <pid>',
    'Explicit PID for harness-agnostic liveness — checked directly via the OS instead of ' +
      "sandpiper's own pidfile registry. Any caller can pass its own long-lived process's PID here " +
      'without needing to know anything about sandpiper session internals.',
  )
  .option('-s, --session-file <path>', 'Path to file containing section body (if not provided, reads from stdin)')
  .action(async (opts, cmd) => {
    const context = resolveStandupCommandContext({
      rootDir: getRootDir(cmd as Command),
      cwd: process.cwd(),
      env: process.env,
      sessionId: opts.id,
      sessionFile: opts.file,
    });
    const { sessionId, sessionFile } = context.session;

    if (!sessionId) {
      console.error(formatMissingSessionIdMessage());
      process.exitCode = 1;
      return;
    }

    let pid: number | undefined;
    if (opts.pid !== undefined) {
      pid = Number.parseInt(opts.pid, 10);
      if (Number.isNaN(pid)) {
        console.error(`Invalid --pid: "${opts.pid}" is not a number.`);
        process.exitCode = 1;
        return;
      }
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

    // Parse existing content. Every section is preserved as-is (parseStandup's
    // legacy fallback already yields a single "unknown" section for old-format
    // files, so no separate legacy handling is needed here) — write only
    // upserts the current session's own section; it never prunes anyone
    // else's, dead or alive. Only an explicit `cleanup` call may remove a
    // section, since a dormant thread may be intentionally revisited months
    // later.
    const parsed = parseStandup(existingContent);

    // Create new section
    const now = new Date().toISOString();
    const newSection: StandupSection = {
      id: sessionId,
      updated: now,
      sessionFile: sessionFile ?? '',
      pid,
      body: body.trim(),
    };

    // Check if section already exists and update it
    const existingSectionIndex = parsed.sections.findIndex((s) => s.id === sessionId);

    let sections: StandupSection[];
    if (existingSectionIndex >= 0) {
      sections = [...parsed.sections];
      sections[existingSectionIndex] = newSection;
    } else {
      sections = [...parsed.sections, newSection];
    }

    // Serialize and write atomically
    const serialized = serializeStandup(sections);
    const tempPath = `${context.standupPath}.tmp`;
    writeFileSync(tempPath, serialized, 'utf-8');
    renameSync(tempPath, context.standupPath);
  });
