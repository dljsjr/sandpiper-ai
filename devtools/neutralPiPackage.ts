#!/usr/bin/env node

import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import rootJson from '../package.json' with { type: 'json' };
import autotoonPackageJson from '../packages/capability-autotoon/package.json' with { type: 'json' };

interface RootPackageJson {
  readonly version: string;
  readonly license?: string;
  readonly workspaces?: {
    readonly catalogs?: Record<string, Record<string, string>>;
  };
}

interface PackageJsonWithDependencies {
  readonly dependencies?: Record<string, string>;
}

export interface NeutralPiPackageJson {
  readonly name: 'sandpiper-ai-neutral-pi-package';
  readonly version: string;
  readonly private: true;
  readonly type: 'module';
  readonly description: string;
  readonly keywords: readonly ['pi-package'];
  readonly license?: string;
  readonly dependencies: Record<string, string>;
  readonly peerDependencies: Record<string, string>;
  readonly pi: {
    readonly extensions: readonly [
      './extensions/capabilities.ts',
      './extensions/shell-relay',
      './extensions/web-fetch',
      './extensions/autotoon',
    ];
    readonly skills: readonly ['./skills/sandpiper', './skills/third-party'];
    readonly prompts: readonly ['./prompts'];
    readonly themes: readonly ['./themes'];
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
  { from: 'extensions/capabilities.ts', to: 'extensions/capabilities.ts' },
  { from: 'extensions/system/background-process-hooks.ts', to: 'extensions/system/background-process-hooks.ts' },
  { from: 'extensions/system/background-process-tools.ts', to: 'extensions/system/background-process-tools.ts' },
  {
    from: 'extensions/system/neutral-capability-extension.ts',
    to: 'extensions/system/neutral-capability-extension.ts',
  },
  { from: 'extensions/shell-relay', to: 'extensions/shell-relay' },
  { from: 'extensions/web-fetch', to: 'extensions/web-fetch' },
  { from: 'extensions/autotoon', to: 'extensions/autotoon' },
  { from: 'packages/capability-autotoon', to: 'packages/capability-autotoon' },
  { from: 'packages/core', to: 'packages/core' },
  { from: 'skills/sandpiper', to: 'skills/sandpiper' },
  { from: 'skills/third-party', to: 'skills/third-party' },
  { from: 'prompts', to: 'prompts' },
  { from: 'themes', to: 'themes' },
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

function packageDependencyVersion(packageJson: PackageJsonWithDependencies, dependency: string): string {
  const version = packageJson.dependencies?.[dependency];

  if (version === undefined) {
    throw new Error(`Missing package dependency version for ${dependency}`);
  }

  return version;
}

function catalogVersion(rootPackageJson: RootPackageJson, catalog: string, dependency: string): string {
  const version = rootPackageJson.workspaces?.catalogs?.[catalog]?.[dependency];

  if (version === undefined) {
    throw new Error(`Missing catalog version for ${catalog}.${dependency}`);
  }

  return version;
}

export function createNeutralPiPackageJson(rootPackageJson: RootPackageJson): NeutralPiPackageJson {
  return {
    name: 'sandpiper-ai-neutral-pi-package',
    version: rootPackageJson.version,
    private: true,
    type: 'module',
    description: 'Neutral Sandpiper capabilities and resources for vanilla Pi',
    keywords: ['pi-package'],
    license: rootPackageJson.license,
    dependencies: {
      '@mozilla/readability': catalogVersion(rootPackageJson, 'web', '@mozilla/readability'),
      '@toon-format/toon': packageDependencyVersion(autotoonPackageJson, '@toon-format/toon'),
      jsdom: catalogVersion(rootPackageJson, 'web', 'jsdom'),
      'sandpiper-ai-core': 'file:./packages/core',
      'sandpiper-capability-autotoon': 'file:./packages/capability-autotoon',
      turndown: catalogVersion(rootPackageJson, 'web', 'turndown'),
    },
    peerDependencies: {
      '@mariozechner/pi-coding-agent': '*',
      '@mariozechner/pi-tui': '*',
      '@sinclair/typebox': '*',
    },
    pi: {
      extensions: [
        './extensions/capabilities.ts',
        './extensions/shell-relay',
        './extensions/web-fetch',
        './extensions/autotoon',
      ],
      skills: ['./skills/sandpiper', './skills/third-party'],
      prompts: ['./prompts'],
      themes: ['./themes'],
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
