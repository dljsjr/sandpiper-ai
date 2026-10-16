#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { access, copyFile, cp, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import rootJson from '../package.json' with { type: 'json' };
import cliPackageJson from '../packages/cli/package.json' with { type: 'json' };

interface RootPackageJson {
  readonly version: string;
  readonly license?: string;
}

interface CliPackageJson {
  readonly dependencies?: Record<string, string>;
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

interface BunCompileOptions {
  readonly autoloadBunfig?: boolean;
  readonly autoloadDotenv?: boolean;
}

interface BunBuildOptions {
  readonly entrypoints: readonly string[];
  readonly outdir: string;
  readonly target: 'bun';
  readonly minify: boolean;
  readonly compile: boolean | BunCompileOptions;
  readonly external: readonly string[];
  readonly plugins: readonly BunBuildPlugin[];
}

interface BunRuntime {
  build(options: BunBuildOptions): Promise<BunBuildResult>;
}

declare const Bun: BunRuntime;

const STANDALONE_APP_COPY_ENTRIES: readonly CopyEntry[] = [
  { from: 'extensions', to: 'extensions' },
  { from: 'packages/resources', to: 'packages/resources' },
  { from: 'packages/capability-autotoon', to: 'packages/capability-autotoon' },
  { from: 'packages/core', to: 'packages/core' },
  { from: 'docs', to: 'docs' },
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

function packageDependencyVersion(packageJson: CliPackageJson, dependency: string): string {
  const version = packageJson.dependencies?.[dependency];

  if (version === undefined) {
    throw new Error(`Missing package dependency version for ${dependency}`);
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
    piCodingAgentVersion: packageDependencyVersion(cliPackageJson, '@earendil-works/pi-coding-agent'),
    piConfig: {
      name: 'sandpiper',
      configDir: '.sandpiper',
      bin: 'sandpiper',
    },
  };
}

function cssTreeBundledDataPlugin(repoRoot: string): BunBuildPlugin {
  const cssTreeDataPath = join(repoRoot, 'node_modules', 'css-tree', 'lib', 'data.js');

  return {
    name: 'css-tree-bundled-data',
    setup(build) {
      build.onLoad({ filter: /css-tree\/lib\/data\.js$/ }, () => {
        const source = readFileSync(cssTreeDataPath, 'utf-8');
        const bundledSource = source.replace(
          "import { createRequire } from 'module';\nimport patch from './data-patch.js';\n\nconst require = createRequire(import.meta.url);\nconst mdnAtrules = require('mdn-data/css/at-rules.json');\nconst mdnProperties = require('mdn-data/css/properties.json');\nconst mdnSyntaxes = require('mdn-data/css/syntaxes.json');",
          `import patch from ${JSON.stringify(join(repoRoot, 'node_modules', 'css-tree', 'data', 'patch.json'))} with { type: 'json' };\nimport mdnAtrules from ${JSON.stringify(join(repoRoot, 'node_modules', 'mdn-data', 'css', 'at-rules.json'))} with { type: 'json' };\nimport mdnProperties from ${JSON.stringify(join(repoRoot, 'node_modules', 'mdn-data', 'css', 'properties.json'))} with { type: 'json' };\nimport mdnSyntaxes from ${JSON.stringify(join(repoRoot, 'node_modules', 'mdn-data', 'css', 'syntaxes.json'))} with { type: 'json' };`,
        );

        if (bundledSource === source) {
          throw new Error('Unable to bundle css-tree/mdn-data JSON imports for standalone app');
        }

        return { loader: 'js', contents: bundledSource };
      });
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
    // Upstream #7684: a cwd bunfig.toml with preload scripts crashes compiled Bun binaries at
    // startup (Bun tries to run the user's project preload scripts inside the standalone
    // executable, which has no matching project). autoloadBunfig defaults to true; disable it
    // so a compiled sandpiper binary never reads whatever bunfig.toml happens to be in its
    // launch cwd. Confirmed the Bun.build JS API exposes this directly (as
    // CompileBuildOptions.autoloadBunfig in Bun's own bun-types package, equivalent to the
    // --no-compile-autoload-bunfig CLI flag) -- no need to shell out to `bun build --compile`
    // the way upstream's scripts/build-binaries.sh does. This file hand-rolls a minimal ambient
    // Bun type locally (see BunBuildOptions above) rather than depending on bun-types, so
    // BunCompileOptions widens `compile` to accept these fields.
    // Pi #10473: autoloadDotenv likewise defaults to true and would load a launch-cwd .env into
    // Sandpiper's environment.
    compile: { autoloadBunfig: false, autoloadDotenv: false },
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

function readOptionValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;

  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`Missing value for ${name}`);
  }
  return value;
}

const entrypoint = process.argv[1] === undefined ? undefined : resolve(process.argv[1]);

if (entrypoint === fileURLToPath(import.meta.url)) {
  const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const piDistDir = dirname(fileURLToPath(import.meta.resolve('@earendil-works/pi-coding-agent')));
  const options = {
    repoRoot,
    outputDir: resolve(readOptionValue('--output-dir') ?? join(repoRoot, 'dist', 'standalone-sandpiper')),
    piPackageDir: dirname(piDistDir),
  };

  if (process.argv.includes('--compile')) {
    await buildStandaloneSandpiperApp(options);
  } else {
    await assembleStandaloneSandpiperApp(options);
  }
}
