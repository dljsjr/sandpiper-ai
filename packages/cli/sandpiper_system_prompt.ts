#!/usr/bin/env bun

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  configurePiEnvironment,
  mirrorPiSandpiperEnvironment,
  resolveStandalonePaths,
} from './standalone_bootstrap.js';

interface PiMetadata {
  readonly packageDir: string;
  readonly version: string;
}

function resolvePiMetadata(): PiMetadata {
  const piDistDir = dirname(fileURLToPath(import.meta.resolve('@earendil-works/pi-coding-agent')));
  const piPackageDir = dirname(piDistDir);
  const packageJson = JSON.parse(readFileSync(join(piPackageDir, 'package.json'), 'utf-8')) as {
    version: string;
  };
  return { packageDir: piPackageDir, version: packageJson.version };
}

async function writeStdout(text: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    process.stdout.write(`${text}\n`, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

// Rendering runs a real turn against a capture provider, so extensions may write to stdout in
// response to it (terminal notifications on agent_end, for example). That output belongs to a
// turn nobody asked for: drop it, so stdout carries only the diagnostic's output and stderr only
// real warnings.
async function withExtensionStdoutDiscarded<T>(render: () => Promise<T>): Promise<T> {
  const stdoutWrite = process.stdout.write;
  const consoleLog = console.log;
  const consoleInfo = console.info;
  const discardWrite = (_chunk: unknown, encodingOrCallback?: unknown, callback?: unknown): boolean => {
    const done = typeof encodingOrCallback === 'function' ? encodingOrCallback : callback;
    if (typeof done === 'function') queueMicrotask(() => done());
    return true;
  };
  process.stdout.write = discardWrite as typeof process.stdout.write;
  console.log = () => {};
  console.info = () => {};
  try {
    return await render();
  } finally {
    process.stdout.write = stdoutWrite;
    console.log = consoleLog;
    console.info = consoleInfo;
  }
}

function printHelp(): void {
  console.log(`sandpiper-system-prompt - render the effective Sandpiper system prompt

Usage:
  sandpiper-system-prompt [sandpiper options]

The command performs normal extension, tool, skill, and context discovery without
loading stored provider credentials or sending a request to a model. The rendered
prompt is written to stdout. Use
--approve to include untrusted project-local resources and --json to include
file-backed prompt source metadata.`);
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  printHelp();
} else {
  process.title = 'sandpiper-system-prompt';
  process.env.AI_AGENT = 'sandpiper';
  process.env.PI_OFFLINE = '1';

  try {
    const scriptDir = dirname(fileURLToPath(import.meta.url));
    const standalonePaths = resolveStandalonePaths({
      startDir: scriptDir,
      env: process.env,
    });
    const piMetadata = resolvePiMetadata();

    configurePiEnvironment(
      {
        packageDir: standalonePaths.packageDir,
        piPackageDir: piMetadata.packageDir,
        piVersion: piMetadata.version,
      },
      process.env,
    );
    mirrorPiSandpiperEnvironment(process.env);

    const { renderSystemPrompt } = await import('./system_prompt_diagnostic.js');
    const result = await withExtensionStdoutDiscarded(() =>
      renderSystemPrompt({
        args,
        cwd: process.cwd(),
      }),
    );
    for (const warning of result.warnings) {
      console.error(`Warning: ${warning}`);
    }
    await writeStdout(result.json ? JSON.stringify(result) : result.prompt);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
