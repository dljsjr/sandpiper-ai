#!/usr/bin/env bun

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  configurePiEnvironment,
  mirrorPiSandpiperEnvironment,
  prepareStandalonePackageDir,
  resolveStandalonePaths,
  type StandalonePaths,
} from './standalone_bootstrap.js';

interface PiMetadata {
  readonly packageDir: string;
  readonly version: string;
}

function resolvePiMetadata(standalonePaths: StandalonePaths): PiMetadata {
  if (standalonePaths.packageDirSource === 'app-bundle') {
    const packageJson = JSON.parse(readFileSync(join(standalonePaths.packageDir, 'package.json'), 'utf-8')) as {
      piCodingAgentVersion?: string;
    };
    if (packageJson.piCodingAgentVersion === undefined) {
      throw new Error('Standalone app package.json is missing piCodingAgentVersion');
    }
    return { packageDir: standalonePaths.packageDir, version: packageJson.piCodingAgentVersion };
  }

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

function printHelp(): void {
  console.log(`sandpiper-system-prompt - render the effective Sandpiper system prompt

Usage:
  sandpiper-system-prompt [sandpiper options]

The command performs normal extension, tool, skill, and context discovery without
sending a request to a model. The rendered prompt is written to stdout. Use
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
      executablePath: process.execPath,
      env: process.env,
    });
    const piMetadata = resolvePiMetadata(standalonePaths);

    if (standalonePaths.packageDirSource === 'generated') {
      prepareStandalonePackageDir({
        packageDir: standalonePaths.packageDir,
        resourceRoot: standalonePaths.resourceRoot,
        piPackageDir: piMetadata.packageDir,
      });
    }

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
    const result = await renderSystemPrompt({
      args,
      cwd: process.cwd(),
      resourceRoot: standalonePaths.resourceRoot,
    });
    for (const warning of result.warnings) {
      console.error(`Warning: ${warning}`);
    }
    await writeStdout(result.json ? JSON.stringify(result) : result.prompt);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
