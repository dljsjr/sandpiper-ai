#!/usr/bin/env node

import { chmod, copyFile, cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
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
      readonly args: readonly ['${CLAUDE_PLUGIN_ROOT}/servers/sandpiper-claude-mcp.js'];
      readonly env: {
        readonly SANDPIPER_CLAUDE_PLUGIN_ROOT: '${CLAUDE_PLUGIN_ROOT}';
        readonly SANDPIPER_CLAUDE_PLUGIN_DATA: '${CLAUDE_PLUGIN_DATA}';
      };
    };
  };
}

export interface AssembleClaudeCodePluginOptions {
  readonly repoRoot: string;
  readonly outputDir: string;
}

interface CopyEntry {
  readonly from: string;
  readonly to: string;
}

interface ExecutableCopyEntry {
  readonly from: string;
  readonly to: readonly string[];
}

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
        args: ['${CLAUDE_PLUGIN_ROOT}/servers/sandpiper-claude-mcp.js'],
        env: {
          SANDPIPER_CLAUDE_PLUGIN_ROOT: '${CLAUDE_PLUGIN_ROOT}',
          SANDPIPER_CLAUDE_PLUGIN_DATA: '${CLAUDE_PLUGIN_DATA}',
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

const entrypoint = process.argv[1] === undefined ? undefined : resolve(process.argv[1]);

if (entrypoint === fileURLToPath(import.meta.url)) {
  const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  await assembleClaudeCodePlugin({ repoRoot, outputDir: join(repoRoot, 'dist', 'claude-plugin') });
}
