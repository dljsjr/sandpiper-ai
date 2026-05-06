#!/usr/bin/env node

import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import rootJson from '../package.json' with { type: 'json' };
import {
  createPiPeerDependencies,
  createPiRuntimeDependencies,
  type RootPackageJson,
  writePiArtifactSupportPackageJsons,
} from './piPackageArtifactMetadata.js';

export interface NeutralPiPackageJson {
  readonly name: 'sandpiper-ai-neutral-pi-package';
  readonly version: string;
  readonly type: 'module';
  readonly description: string;
  readonly keywords: readonly ['pi-package'];
  readonly license?: string;
  readonly dependencies: Record<string, string>;
  readonly peerDependencies: Record<string, string>;
  readonly pi: {
    readonly extensions: readonly ['./plugins/pi/extensions'];
    readonly skills: readonly ['./packages/resources/skills/sandpiper', './packages/resources/skills/third-party'];
    readonly prompts: readonly ['./packages/resources/prompts'];
    readonly themes: readonly ['./packages/resources/themes'];
  };
}

export interface AssembleNeutralPiPackageOptions {
  readonly repoRoot: string;
  readonly outputDir: string;
}

interface CopyEntry {
  readonly from: string;
  readonly to: string;
}

const NEUTRAL_PACKAGE_COPY_ENTRIES: readonly CopyEntry[] = [
  { from: 'plugins/pi/extensions', to: 'plugins/pi/extensions' },
  // Compatibility implementation files imported by the provider-owned adapters above.
  { from: 'extensions/system/background-process-hooks.ts', to: 'extensions/system/background-process-hooks.ts' },
  { from: 'extensions/system/background-process-tools.ts', to: 'extensions/system/background-process-tools.ts' },
  {
    from: 'extensions/system/neutral-capability-extension.ts',
    to: 'extensions/system/neutral-capability-extension.ts',
  },
  { from: 'extensions/shell-relay', to: 'extensions/shell-relay' },
  { from: 'extensions/web-fetch', to: 'extensions/web-fetch' },
  { from: 'packages/capability-autotoon', to: 'packages/capability-autotoon' },
  { from: 'packages/core', to: 'packages/core' },
  { from: 'packages/resources', to: 'packages/resources' },
];

function shouldPruneArtifactPath(path: string): boolean {
  const name = basename(path);

  return (
    name === '.DS_Store' ||
    name === 'tsconfig.json' ||
    name === 'vitest.config.ts' ||
    name.endsWith('-workspace') ||
    name.endsWith('.log') ||
    name.endsWith('.pid') ||
    name.endsWith('.test.ts') ||
    name.endsWith('.test.js')
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

export function createNeutralPiPackageJson(rootPackageJson: RootPackageJson): NeutralPiPackageJson {
  return {
    name: 'sandpiper-ai-neutral-pi-package',
    version: rootPackageJson.version,
    type: 'module',
    description: 'Neutral Sandpiper capabilities and resources for vanilla Pi',
    keywords: ['pi-package'],
    license: rootPackageJson.license,
    dependencies: createPiRuntimeDependencies(rootPackageJson),
    peerDependencies: createPiPeerDependencies(),
    pi: {
      extensions: ['./plugins/pi/extensions'],
      skills: ['./packages/resources/skills/sandpiper', './packages/resources/skills/third-party'],
      prompts: ['./packages/resources/prompts'],
      themes: ['./packages/resources/themes'],
    },
  };
}

export async function assembleNeutralPiPackage(options: AssembleNeutralPiPackageOptions): Promise<void> {
  await rm(options.outputDir, { recursive: true, force: true });
  await mkdir(options.outputDir, { recursive: true });

  for (const entry of NEUTRAL_PACKAGE_COPY_ENTRIES) {
    await cp(join(options.repoRoot, entry.from), join(options.outputDir, entry.to), {
      recursive: true,
      force: true,
    });
  }

  await pruneDevelopmentFiles(options.outputDir);
  await writePiArtifactSupportPackageJsons(options.outputDir, rootJson);
  await writeFile(
    join(options.outputDir, 'package.json'),
    `${JSON.stringify(createNeutralPiPackageJson(rootJson), null, 2)}\n`,
  );
}

const entrypoint = process.argv[1] === undefined ? undefined : resolve(process.argv[1]);

if (entrypoint === fileURLToPath(import.meta.url)) {
  const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  await assembleNeutralPiPackage({ repoRoot, outputDir: join(repoRoot, 'dist', 'neutral-pi-package') });
}
