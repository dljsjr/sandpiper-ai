#!/usr/bin/env node

import { chmod, copyFile, cp, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import rootJson from '../package.json' with { type: 'json' };

interface RootPackageJson {
  readonly version: string;
  readonly license?: string;
}

export interface ClaudePluginManifest {
  readonly name: 'sandpiper-neutral';
  readonly version: string;
  readonly description: string;
  readonly license?: string;
  readonly keywords: readonly ['sandpiper', 'claude-code', 'mcp'];
  readonly skills: readonly ['./skills/sandpiper/', './skills/third-party/'];
  readonly commands: './commands/';
  readonly themes: './themes/';
  readonly mcpServers: './.mcp.json';
}

export interface ClaudePluginMcpConfig {
  readonly mcpServers: {
    readonly sandpiper: {
      readonly command: 'node';
      readonly args: readonly [string];
      readonly env: {
        readonly SANDPIPER_CLAUDE_PLUGIN_ROOT: string;
        readonly SANDPIPER_CLAUDE_PLUGIN_DATA: string;
      };
    };
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
  { from: 'skills/sandpiper', to: 'skills/sandpiper' },
  { from: 'skills/third-party', to: 'skills/third-party' },
  { from: 'prompts', to: 'commands' },
  { from: 'themes', to: 'themes' },
];

const ROOT_OPTIONAL_COPY_ENTRIES: readonly CopyEntry[] = [
  { from: 'README.md', to: 'README.md' },
  { from: 'LICENSE', to: 'LICENSE' },
  { from: 'CHANGELOG.md', to: 'CHANGELOG.md' },
];

const CLAUDE_PLUGIN_ROOT_VARIABLE = '${' + 'CLAUDE_PLUGIN_ROOT}';
const CLAUDE_PLUGIN_DATA_VARIABLE = '${' + 'CLAUDE_PLUGIN_DATA}';
const CLAUDE_PLUGIN_MCP_SERVER_PATH = `${CLAUDE_PLUGIN_ROOT_VARIABLE}/servers/sandpiper-claude-mcp.js`;

const GENERATED_EXECUTABLE_COPY_ENTRIES: readonly ExecutableCopyEntry[] = [
  {
    from: 'dist/packages/sandpiper-tasks-cli/sandpiper-tasks',
    to: ['skills/sandpiper/tasks/scripts/sandpiper-tasks', 'bin/sandpiper-tasks'],
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

export function createClaudePluginManifest(rootPackageJson: RootPackageJson): ClaudePluginManifest {
  return {
    name: 'sandpiper-neutral',
    version: rootPackageJson.version,
    description: 'Neutral Sandpiper capabilities and resources for Claude Code',
    license: rootPackageJson.license,
    keywords: ['sandpiper', 'claude-code', 'mcp'],
    skills: ['./skills/sandpiper/', './skills/third-party/'],
    commands: './commands/',
    themes: './themes/',
    mcpServers: './.mcp.json',
  };
}

export function createClaudePluginMcpConfig(): ClaudePluginMcpConfig {
  return {
    mcpServers: {
      sandpiper: {
        command: 'node',
        args: [CLAUDE_PLUGIN_MCP_SERVER_PATH],
        env: {
          SANDPIPER_CLAUDE_PLUGIN_ROOT: CLAUDE_PLUGIN_ROOT_VARIABLE,
          SANDPIPER_CLAUDE_PLUGIN_DATA: CLAUDE_PLUGIN_DATA_VARIABLE,
        },
      },
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

  await mkdir(join(options.outputDir, '.claude-plugin'), { recursive: true });
  await writeFile(
    join(options.outputDir, '.claude-plugin', 'plugin.json'),
    `${JSON.stringify(createClaudePluginManifest(rootJson), null, 2)}\n`,
  );
  await writeFile(join(options.outputDir, '.mcp.json'), `${JSON.stringify(createClaudePluginMcpConfig(), null, 2)}\n`);
}

function formatBuildLogs(logs: readonly BunBuildMessage[]): string {
  return logs.map((log) => log.message).join('\n');
}

export async function buildClaudeCodePlugin(options: BuildClaudeCodePluginOptions): Promise<void> {
  await assembleClaudeCodePlugin(options);

  const serverOutputDir = join(options.outputDir, 'servers');
  await mkdir(serverOutputDir, { recursive: true });

  const buildResult = await Bun.build({
    entrypoints: [join(options.repoRoot, 'packages', 'adapter-claude-mcp', 'src', 'stdio.ts')],
    outdir: serverOutputDir,
    target: 'node',
    minify: true,
  });

  if (!buildResult.success) {
    throw new Error(`Failed to build Claude plugin MCP server:\n${formatBuildLogs(buildResult.logs)}`);
  }

  await rm(join(serverOutputDir, 'sandpiper-claude-mcp.js'), { force: true });
  await rename(join(serverOutputDir, 'stdio.js'), join(serverOutputDir, 'sandpiper-claude-mcp.js'));
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
