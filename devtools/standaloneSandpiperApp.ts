#!/usr/bin/env node

import { access, copyFile, cp, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import rootJson from '../package.json' with { type: 'json' };

interface RootPackageJson {
  readonly version: string;
  readonly license?: string;
  readonly workspaces?: {
    readonly catalogs?: Record<string, Record<string, string>>;
  };
}

export interface StandaloneSandpiperAppPackageJson {
  readonly name: 'sandpiper-ai-standalone-app';
  readonly version: string;
  readonly private: true;
  readonly type: 'module';
  readonly description: string;
  readonly license?: string;
  readonly piCodingAgentVersion: string;
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

export type BuildStandaloneSandpiperAppOptions = AssembleStandaloneSandpiperAppOptions;

interface CopyEntry {
  readonly from: string;
  readonly to: string;
}

interface BunBuildMessage {
  readonly message: string;
}

interface BunBuildResult {
  readonly success: boolean;
  readonly logs: readonly BunBuildMessage[];
}

interface BunPluginBuilder {
  onLoad(
    options: { readonly filter: RegExp },
    callback: () => { readonly loader: 'js'; readonly contents: string },
  ): void;
}

interface BunBuildPlugin {
  readonly name: string;
  setup(build: BunPluginBuilder): void;
}

interface BunBuildOptions {
  readonly entrypoints: readonly string[];
  readonly outdir: string;
  readonly target: 'bun';
  readonly minify: boolean;
  readonly compile: boolean;
  readonly external: readonly string[];
  readonly plugins: readonly BunBuildPlugin[];
}

interface BunRuntime {
  build(options: BunBuildOptions): Promise<BunBuildResult>;
}

declare const Bun: BunRuntime;

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

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
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

function catalogVersion(rootPackageJson: RootPackageJson, catalog: string, dependency: string): string {
  const version = rootPackageJson.workspaces?.catalogs?.[catalog]?.[dependency];

  if (version === undefined) {
    throw new Error(`Missing catalog version for ${catalog}.${dependency}`);
  }

  return version;
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
    piCodingAgentVersion: catalogVersion(rootPackageJson, 'pi', '@mariozechner/pi-coding-agent'),
    piConfig: {
      name: 'sandpiper',
      configDir: '.sandpiper',
      bin: 'sandpiper',
    },
  };
}

function cssTreeBundledDataPlugin(repoRoot: string): BunBuildPlugin {
  return {
    name: 'css-tree-bundled-data',
    setup(build) {
      build.onLoad({ filter: /css-tree\/lib\/data-patch\.js$/ }, () => ({
        loader: 'js',
        contents: `import patch from ${JSON.stringify(join(repoRoot, 'node_modules', 'css-tree', 'data', 'patch.json'))} with { type: 'json' }; export default patch;`,
      }));
      build.onLoad({ filter: /css-tree\/lib\/version\.js$/ }, () => ({
        loader: 'js',
        contents: `import packageJson from ${JSON.stringify(join(repoRoot, 'node_modules', 'css-tree', 'package.json'))} with { type: 'json' }; export const { version } = packageJson;`,
      }));
    },
  };
}

function formatBuildLogs(logs: readonly BunBuildMessage[]): string {
  return logs.map((log) => log.message).join('\n');
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

export async function buildStandaloneSandpiperApp(options: BuildStandaloneSandpiperAppOptions): Promise<void> {
  await assembleStandaloneSandpiperApp(options);

  const buildResult = await Bun.build({
    entrypoints: [join(options.repoRoot, 'packages', 'cli', 'sandpiper_standalone.ts')],
    outdir: options.outputDir,
    target: 'bun',
    minify: true,
    compile: true,
    external: ['canvas'],
    plugins: [cssTreeBundledDataPlugin(options.repoRoot)],
  });

  if (!buildResult.success) {
    throw new Error(`Failed to build standalone Sandpiper app executable:\n${formatBuildLogs(buildResult.logs)}`);
  }

  const defaultOutputPath = join(options.outputDir, 'sandpiper_standalone');
  const executablePath = join(options.outputDir, 'sandpiper');

  if (await pathExists(defaultOutputPath)) {
    await rm(executablePath, { force: true });
    await rename(defaultOutputPath, executablePath);
    return;
  }

  if (await pathExists(executablePath)) return;

  throw new Error(`Standalone Sandpiper app build did not emit ${defaultOutputPath} or ${executablePath}`);
}

const entrypoint = process.argv[1] === undefined ? undefined : resolve(process.argv[1]);

if (entrypoint === fileURLToPath(import.meta.url)) {
  const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const piDistDir = dirname(fileURLToPath(import.meta.resolve('@mariozechner/pi-coding-agent')));
  const options = {
    repoRoot,
    outputDir: join(repoRoot, 'dist', 'standalone-sandpiper'),
    piPackageDir: dirname(piDistDir),
  };

  if (process.argv.includes('--compile')) {
    await buildStandaloneSandpiperApp(options);
  } else {
    await assembleStandaloneSandpiperApp(options);
  }
}
