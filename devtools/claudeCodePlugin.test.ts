import { existsSync, lstatSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import rootPackageJson from '../package.json' with { type: 'json' };
import {
  assembleClaudeCodePlugin,
  createClaudePluginHooksConfig,
  createClaudePluginManifest,
  createClaudePluginPackageJson,
} from './claudeCodePlugin.js';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const claudePluginRootVariable = '${' + 'CLAUDE_PLUGIN_ROOT}';
const claudeAutoToonHookPath = `${claudePluginRootVariable}/hooks/autotoon-post-tool-use.js`;

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

describe('Claude Code plugin mapping', () => {
  it('maps neutral Sandpiper resources to Claude plugin component paths', () => {
    const manifest = createClaudePluginManifest(rootPackageJson);

    expect(manifest).toMatchObject({
      name: 'sandpiper-neutral',
      version: rootPackageJson.version,
      description: 'Neutral Sandpiper capabilities and resources for Claude Code',
      skills: ['./skills/sandpiper/', './skills/third-party/'],
      commands: './commands/',
      themes: './themes/',
      hooks: './hooks/hooks.json',
      license: rootPackageJson.license,
    });
    expect(manifest).not.toHaveProperty('pi');
    expect(manifest).not.toHaveProperty('piConfig');
    expect(manifest).not.toHaveProperty('bin');
    expect(manifest).not.toHaveProperty('mcpServers');
  });

  it('creates plugin package metadata that lets Node run bundled ESM hook scripts', () => {
    const packageJson = createClaudePluginPackageJson(rootPackageJson);

    expect(packageJson).toMatchObject({
      name: 'sandpiper-neutral-claude-plugin',
      version: rootPackageJson.version,
      private: true,
      type: 'module',
      license: rootPackageJson.license,
    });
  });

  it('declares AutoTOON as a Claude PostToolUse hook', () => {
    const hooksConfig = createClaudePluginHooksConfig();

    expect(hooksConfig).toEqual({
      description: 'Sandpiper Claude Code hooks',
      hooks: {
        PostToolUse: [
          {
            hooks: [
              {
                type: 'command',
                command: `node "${claudeAutoToonHookPath}"`,
              },
            ],
          },
        ],
      },
    });
  });

  it('assembles a self-contained plugin resource tree without workspace symlinks', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'sandpiper-claude-plugin-'));

    try {
      const outputDir = join(tempDir, 'plugin');
      await assembleClaudeCodePlugin({ repoRoot, outputDir });

      const manifest = readJsonFile<ReturnType<typeof createClaudePluginManifest>>(
        join(outputDir, '.claude-plugin', 'plugin.json'),
      );
      const hooksConfig = readJsonFile<ReturnType<typeof createClaudePluginHooksConfig>>(
        join(outputDir, 'hooks', 'hooks.json'),
      );
      const packageJson = readJsonFile<ReturnType<typeof createClaudePluginPackageJson>>(
        join(outputDir, 'package.json'),
      );

      expect(manifest.skills).toEqual(['./skills/sandpiper/', './skills/third-party/']);
      expect(manifest.commands).toBe('./commands/');
      expect(manifest.themes).toBe('./themes/');
      expect(manifest.hooks).toBe('./hooks/hooks.json');
      expect(manifest).not.toHaveProperty('piConfig');
      expect(manifest).not.toHaveProperty('mcpServers');
      expect(packageJson.type).toBe('module');
      expect(hooksConfig.hooks.PostToolUse[0].hooks[0].command).toBe(`node "${claudeAutoToonHookPath}"`);
      expect(existsSync(join(outputDir, '.mcp.json'))).toBe(false);

      for (const relativePath of [
        'skills/sandpiper/tasks/SKILL.md',
        'skills/sandpiper/standup/SKILL.md',
        'skills/third-party/pdf/SKILL.md',
        'commands/new-feature.md',
        'hooks/hooks.json',
        'package.json',
        'themes/README.md',
        'LICENSE',
      ]) {
        expect(existsSync(join(outputDir, relativePath)), relativePath).toBe(true);
      }

      for (const relativePath of [
        'skills/sandpiper/tasks/scripts/sandpiper-tasks',
        'skills/sandpiper/standup/scripts/sandpiper-standup',
        'skills/sandpiper/dash/scripts/dash',
        'bin/sandpiper-tasks',
        'bin/sandpiper-standup',
        'bin/dash',
      ]) {
        const path = join(outputDir, relativePath);
        expect(existsSync(path), relativePath).toBe(true);
        expect(lstatSync(path).isSymbolicLink(), relativePath).toBe(false);
      }

      expect(existsSync(join(outputDir, 'skills', 'sandpiper', '.DS_Store'))).toBe(false);
      expect(existsSync(join(outputDir, 'skills', 'sandpiper', 'tasks', 'SKILL.test.ts'))).toBe(false);
      expect(existsSync(join(outputDir, 'skills', 'sandpiper', 'tasks', 'node_modules'))).toBe(false);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
