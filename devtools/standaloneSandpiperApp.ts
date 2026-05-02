#!/usr/bin/env node

import { copyFile, cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import rootJson from '../package.json' with { type: 'json' };

interface RootPackageJson {
  readonly version: string;
  readonly license?: string;
}

export interface StandaloneSandpiperAppPackageJson {
  readonly name: 'sandpiper-ai-standalone-app';
  readonly version: string;
  readonly private: true;
  readonly type: 'module';
  readonly description: string;
  readonly license?: string;
  readonly piConfig: {
    readonly name: 'sandpiper';
    readonly configDir: '.sandpiper';
    readonly bin: 'sandpiper';
  };
}

export interface AssembleStandaloneSandpiperAppOptions {
  readonly repoRoot: string;
  readonly outputDir: string;
  readonly piPackageDir: string;
}

interface CopyEntry {
  readonly from: string;
  readonly to: string;
}

const STANDALONE_APP_COPY_ENTRIES: readonly CopyEntry[] = [
  { from: 'extensions', to: 'extensions' },
  { from: 'skills/sandpiper', to: 'skills/sandpiper' },
  { from: 'skills/third-party', to: 'skills/third-party' },
  { from: 'prompts', to: 'prompts' },
  { from: 'themes', to: 'themes' },
  { from: 'packages/capability-autotoon', to: 'packages/capability-autotoon' },
  { from: 'packages/core', to: 'packages/core' },
];

const ROOT_OPTIONAL_COPY_ENTRIES: readonly CopyEntry[] = [
  { from: 'README.md', to: 'README.md' },
  { from: 'CHANGELOG.md', to: 'CHANGELOG.md' },
];

function shouldPruneArtifactPath(path: string): boolean {
  const name = basename(path);

  return (
    name === 'tsconfig.json' || name === 'vitest.config.ts' || name.endsWith('.test.ts') || name.endsWith('.test.js')
  );
}

async function pruneDevelopmentFiles(directory: string): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);

      if (entry.name === 'node_modules' || shouldPruneArtifactPath(path)) {
        await rm(path, { recursive: true, force: true });
        return;
      }

      if (entry.isDirectory()) {
        await pruneDevelopmentFiles(path);
      }
    }),
  );
}

async function copyIfPresent(source: string, destination: string): Promise<void> {
  try {
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return;
    throw error;
  }
}

export function createStandaloneSandpiperAppPackageJson(
  rootPackageJson: RootPackageJson,
): StandaloneSandpiperAppPackageJson {
  return {
    name: 'sandpiper-ai-standalone-app',
    version: rootPackageJson.version,
    private: true,
    type: 'module',
    description: 'Standalone Sandpiper app bundle metadata',
    license: rootPackageJson.license,
    piConfig: {
      name: 'sandpiper',
      configDir: '.sandpiper',
      bin: 'sandpiper',
    },
  };
}

export async function assembleStandaloneSandpiperApp(options: AssembleStandaloneSandpiperAppOptions): Promise<void> {
  await rm(options.outputDir, { recursive: true, force: true });
  await mkdir(options.outputDir, { recursive: true });

  for (const entry of STANDALONE_APP_COPY_ENTRIES) {
    await cp(join(options.repoRoot, entry.from), join(options.outputDir, entry.to), {
      recursive: true,
      force: true,
    });
  }

  for (const entry of ROOT_OPTIONAL_COPY_ENTRIES) {
    await copyIfPresent(join(options.repoRoot, entry.from), join(options.outputDir, entry.to));
  }

  await cp(join(options.piPackageDir, 'dist', 'modes'), join(options.outputDir, 'dist', 'modes'), {
    recursive: true,
    force: true,
  });
  await cp(join(options.piPackageDir, 'dist', 'core'), join(options.outputDir, 'dist', 'core'), {
    recursive: true,
    force: true,
  });

  await pruneDevelopmentFiles(options.outputDir);
  await writeFile(
    join(options.outputDir, 'package.json'),
    `${JSON.stringify(createStandaloneSandpiperAppPackageJson(rootJson), null, 2)}\n`,
  );
}

const entrypoint = process.argv[1] === undefined ? undefined : resolve(process.argv[1]);

if (entrypoint === fileURLToPath(import.meta.url)) {
  const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const piDistDir = dirname(fileURLToPath(import.meta.resolve('@mariozechner/pi-coding-agent')));
  await assembleStandaloneSandpiperApp({
    repoRoot,
    outputDir: join(repoRoot, 'dist', 'standalone-sandpiper'),
    piPackageDir: dirname(piDistDir),
  });
}
