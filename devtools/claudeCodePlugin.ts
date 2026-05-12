#!/usr/bin/env node

import { chmod, copyFile, cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import rootJson from '../package.json' with { type: 'json' };
import {
  normalizePackageAuthor,
  normalizePackageRepository,
  type PackageAuthor,
  type PackageRepository,
} from './piPackageArtifactMetadata.js';

interface RootPackageJson {
  readonly version: string;
  readonly license?: string;
  readonly author?: string | PackageAuthor;
  readonly homepage?: string;
  readonly repository?: string | PackageRepository;
}

export interface ClaudePluginManifest {
  readonly name: 'sandpiper-neutral';
  readonly version: string;
  readonly description: string;
  readonly license?: string;
  readonly author?: PackageAuthor;
  readonly homepage?: string;
  readonly repository?: string;
  readonly keywords: readonly ['sandpiper', 'claude-code', 'hooks'];
  readonly skills: readonly ['./skills/sandpiper/', './skills/third-party/'];
  readonly commands: './commands/';
  readonly themes: './themes/';
  readonly hooks: './hooks/hooks.json';
}

export interface ClaudePluginPackageJson {
  readonly name: 'sandpiper-claude-code-plugin';
  readonly version: string;
  readonly type: 'module';
  readonly description: string;
  readonly author?: PackageAuthor;
  readonly homepage?: string;
  readonly repository?: PackageRepository;
  readonly license?: string;
  readonly keywords: readonly ['sandpiper', 'claude-code', 'claude-plugin', 'hooks'];
  readonly files: readonly [
    '.claude-plugin/',
    'bin/',
    'commands/',
    'hooks/',
    'skills/',
    'themes/',
    'README.md',
    'LICENSE',
  ];
}

export interface ClaudePluginHooksConfig {
  readonly description: string;
  readonly hooks: {
    readonly PostToolUse: readonly [
      {
        readonly hooks: readonly [
          {
            readonly type: 'command';
            readonly command: string;
          },
        ];
      },
    ];
  };
}

export interface AssembleClaudeCodePluginOptions {
  readonly repoRoot: string;
  readonly outputDir: string;
}

export type BuildClaudeCodePluginOptions = AssembleClaudeCodePluginOptions;

interface CopyEntry {
  readonly from: string;
  readonly to: string;
}

interface ExecutableCopyEntry {
  readonly from: string;
  readonly to: readonly string[];
}

interface GeneratedFileCopyEntry {
  readonly from: string;
  readonly to: readonly string[];
}

interface BunBuildMessage {
  readonly message: string;
}

interface BunBuildResult {
  readonly success: boolean;
  readonly logs: readonly BunBuildMessage[];
}

interface BunBuildOptions {
  readonly entrypoints: readonly string[];
  readonly outdir: string;
  readonly target: 'node';
  readonly minify: boolean;
}

interface BunRuntime {
  build(options: BunBuildOptions): Promise<BunBuildResult>;
}

declare const Bun: BunRuntime;

const CLAUDE_PLUGIN_COPY_ENTRIES: readonly CopyEntry[] = [
  { from: 'packages/resources/skills/sandpiper', to: 'skills/sandpiper' },
  { from: 'packages/resources/skills/third-party', to: 'skills/third-party' },
  { from: 'packages/resources/prompts', to: 'commands' },
  { from: 'packages/resources/themes', to: 'themes' },
];

const ROOT_OPTIONAL_COPY_ENTRIES: readonly CopyEntry[] = [
  { from: 'README.md', to: 'README.md' },
  { from: 'LICENSE', to: 'LICENSE' },
  { from: 'CHANGELOG.md', to: 'CHANGELOG.md' },
];

const CLAUDE_PLUGIN_ROOT_VARIABLE = '${' + 'CLAUDE_PLUGIN_ROOT}';
const CLAUDE_AUTOTOON_HOOK_PATH = `${CLAUDE_PLUGIN_ROOT_VARIABLE}/hooks/autotoon-post-tool-use.js`;
const CLAUDE_AUTOTOON_HOOK_COMMAND = `node "${CLAUDE_AUTOTOON_HOOK_PATH}"`;

function createClaudeRepositoryUrl(rootPackageJson: RootPackageJson): string | undefined {
  const repository = normalizePackageRepository(rootPackageJson.repository);
  return repository?.url.replace(/\.git$/, '');
}

const GENERATED_EXECUTABLE_COPY_ENTRIES: readonly ExecutableCopyEntry[] = [
  {
    from: 'dist/packages/trail/trail',
    to: [
      'skills/sandpiper/tasks/scripts/trail',
      'skills/sandpiper/tasks/scripts/sandpiper-tasks',
      'bin/trail',
      'bin/sandpiper-tasks',
    ],
  },
  {
    from: 'dist/packages/sandpiper-standup-cli/sandpiper-standup',
    to: ['skills/sandpiper/standup/scripts/sandpiper-standup', 'bin/sandpiper-standup'],
  },
  {
    from: 'dist/skills/sandpiper/dash/scripts/dash',
    to: ['skills/sandpiper/dash/scripts/dash', 'bin/dash'],
  },
];

const GENERATED_SUPPORT_FILE_COPY_ENTRIES: readonly GeneratedFileCopyEntry[] = [
  {
    from: 'dist/skills/sandpiper/dash/scripts/dash.cjs',
    to: ['skills/sandpiper/dash/scripts/dash.cjs', 'bin/dash.cjs'],
  },
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

async function copyTree(repoRoot: string, outputDir: string, entry: CopyEntry): Promise<void> {
  await cp(join(repoRoot, entry.from), join(outputDir, entry.to), {
    recursive: true,
    force: true,
    dereference: true,
  });
}

async function copyIfPresent(repoRoot: string, outputDir: string, entry: CopyEntry): Promise<void> {
  try {
    await mkdir(dirname(join(outputDir, entry.to)), { recursive: true });
    await copyFile(join(repoRoot, entry.from), join(outputDir, entry.to));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return;
    throw error;
  }
}

async function copyExecutable(repoRoot: string, outputDir: string, entry: ExecutableCopyEntry): Promise<void> {
  for (const relativeDestination of entry.to) {
    const destination = join(outputDir, relativeDestination);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(repoRoot, entry.from), destination);
    await chmod(destination, 0o755);
  }
}

async function copyGeneratedFile(repoRoot: string, outputDir: string, entry: GeneratedFileCopyEntry): Promise<void> {
  for (const relativeDestination of entry.to) {
    const destination = join(outputDir, relativeDestination);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(repoRoot, entry.from), destination);
  }
}

export function createClaudePluginManifest(rootPackageJson: RootPackageJson): ClaudePluginManifest {
  return {
    name: 'sandpiper-neutral',
    version: rootPackageJson.version,
    description: 'Neutral Sandpiper capabilities and resources for Claude Code',
    license: rootPackageJson.license,
    author: normalizePackageAuthor(rootPackageJson.author),
    homepage: rootPackageJson.homepage,
    repository: createClaudeRepositoryUrl(rootPackageJson),
    keywords: ['sandpiper', 'claude-code', 'hooks'],
    skills: ['./skills/sandpiper/', './skills/third-party/'],
    commands: './commands/',
    themes: './themes/',
    hooks: './hooks/hooks.json',
  };
}

export function createClaudePluginPackageJson(rootPackageJson: RootPackageJson): ClaudePluginPackageJson {
  return {
    name: 'sandpiper-claude-code-plugin',
    version: rootPackageJson.version,
    type: 'module',
    description: 'Neutral Sandpiper Claude Code plugin runtime metadata',
    author: normalizePackageAuthor(rootPackageJson.author),
    homepage: rootPackageJson.homepage,
    repository: normalizePackageRepository(rootPackageJson.repository),
    license: rootPackageJson.license,
    keywords: ['sandpiper', 'claude-code', 'claude-plugin', 'hooks'],
    files: ['.claude-plugin/', 'bin/', 'commands/', 'hooks/', 'skills/', 'themes/', 'README.md', 'LICENSE'],
  };
}

export function createClaudePluginHooksConfig(): ClaudePluginHooksConfig {
  return {
    description: 'Sandpiper Claude Code hooks',
    hooks: {
      PostToolUse: [
        {
          hooks: [
            {
              type: 'command',
              command: CLAUDE_AUTOTOON_HOOK_COMMAND,
            },
          ],
        },
      ],
    },
  };
}

export async function assembleClaudeCodePlugin(options: AssembleClaudeCodePluginOptions): Promise<void> {
  await rm(options.outputDir, { recursive: true, force: true });
  await mkdir(options.outputDir, { recursive: true });

  for (const entry of CLAUDE_PLUGIN_COPY_ENTRIES) {
    await copyTree(options.repoRoot, options.outputDir, entry);
  }

  for (const entry of ROOT_OPTIONAL_COPY_ENTRIES) {
    await copyIfPresent(options.repoRoot, options.outputDir, entry);
  }

  await pruneDevelopmentFiles(options.outputDir);

  for (const entry of GENERATED_EXECUTABLE_COPY_ENTRIES) {
    await copyExecutable(options.repoRoot, options.outputDir, entry);
  }

  for (const entry of GENERATED_SUPPORT_FILE_COPY_ENTRIES) {
    await copyGeneratedFile(options.repoRoot, options.outputDir, entry);
  }

  await mkdir(join(options.outputDir, '.claude-plugin'), { recursive: true });
  await mkdir(join(options.outputDir, 'hooks'), { recursive: true });
  await writeFile(
    join(options.outputDir, 'package.json'),
    `${JSON.stringify(createClaudePluginPackageJson(rootJson), null, 2)}\n`,
  );
  await writeFile(
    join(options.outputDir, '.claude-plugin', 'plugin.json'),
    `${JSON.stringify(createClaudePluginManifest(rootJson), null, 2)}\n`,
  );
  await writeFile(
    join(options.outputDir, 'hooks', 'hooks.json'),
    `${JSON.stringify(createClaudePluginHooksConfig(), null, 2)}\n`,
  );
}

function formatBuildLogs(logs: readonly BunBuildMessage[]): string {
  return logs.map((log) => log.message).join('\n');
}

export async function buildClaudeCodePlugin(options: BuildClaudeCodePluginOptions): Promise<void> {
  await assembleClaudeCodePlugin(options);

  const hooksOutputDir = join(options.outputDir, 'hooks');
  await mkdir(hooksOutputDir, { recursive: true });

  const buildResult = await Bun.build({
    entrypoints: [join(options.repoRoot, 'packages', 'adapter-claude-code', 'src', 'autotoon-post-tool-use.ts')],
    outdir: hooksOutputDir,
    target: 'node',
    minify: true,
  });

  if (!buildResult.success) {
    throw new Error(`Failed to build Claude plugin AutoTOON hook:\n${formatBuildLogs(buildResult.logs)}`);
  }
}

const entrypoint = process.argv[1] === undefined ? undefined : resolve(process.argv[1]);

if (entrypoint === fileURLToPath(import.meta.url)) {
  const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const options = { repoRoot, outputDir: join(repoRoot, 'dist', 'claude-plugin') };

  if (process.argv.includes('--build')) {
    await buildClaudeCodePlugin(options);
  } else {
    await assembleClaudeCodePlugin(options);
  }
}
