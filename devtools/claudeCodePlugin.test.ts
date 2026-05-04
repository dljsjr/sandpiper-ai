import { existsSync, lstatSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import rootPackageJson from '../package.json' with { type: 'json' };
import {
  assembleClaudeCodePlugin,
  createClaudePluginManifest,
  createClaudePluginMcpConfig,
} from './claudeCodePlugin.js';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const claudePluginRootVariable = '${' + 'CLAUDE_PLUGIN_ROOT}';
const claudePluginDataVariable = '${' + 'CLAUDE_PLUGIN_DATA}';
const claudePluginMcpServerPath = `${claudePluginRootVariable}/servers/sandpiper-claude-mcp.js`;

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
      mcpServers: './.mcp.json',
      license: rootPackageJson.license,
    });
    expect(manifest).not.toHaveProperty('pi');
    expect(manifest).not.toHaveProperty('piConfig');
    expect(manifest).not.toHaveProperty('bin');
  });

  it('declares a bundled stdio MCP server using Claude plugin path variables', () => {
    const mcpConfig = createClaudePluginMcpConfig();

    expect(mcpConfig).toEqual({
      mcpServers: {
        sandpiper: {
          command: 'node',
          args: [claudePluginMcpServerPath],
          env: {
            SANDPIPER_CLAUDE_PLUGIN_ROOT: claudePluginRootVariable,
            SANDPIPER_CLAUDE_PLUGIN_DATA: claudePluginDataVariable,
          },
        },
      },
    });
  });

  it('assembles a self-contained plugin resource tree without workspace symlinks', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'sandpiper-claude-plugin-'));

    try {
      const outputDir = join(tempDir, 'plugin');
      await assembleClaudeCodePlugin({ repoRoot, outputDir });

      const manifest = JSON.parse(
        readFileSync(join(outputDir, '.claude-plugin', 'plugin.json'), 'utf-8'),
      ) as ReturnType<typeof createClaudePluginManifest>;
      const mcpConfig = JSON.parse(readFileSync(join(outputDir, '.mcp.json'), 'utf-8')) as ReturnType<
        typeof createClaudePluginMcpConfig
      >;

      expect(manifest.skills).toEqual(['./skills/sandpiper/', './skills/third-party/']);
      expect(manifest.commands).toBe('./commands/');
      expect(manifest.themes).toBe('./themes/');
      expect(manifest).not.toHaveProperty('piConfig');
      expect(mcpConfig.mcpServers.sandpiper.args).toEqual([claudePluginMcpServerPath]);

      for (const relativePath of [
        'skills/sandpiper/tasks/SKILL.md',
        'skills/sandpiper/standup/SKILL.md',
        'skills/third-party/pdf/SKILL.md',
        'commands/new-feature.md',
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

      expect(existsSync(join(outputDir, 'skills', 'sandpiper', 'tasks', 'SKILL.test.ts'))).toBe(false);
      expect(existsSync(join(outputDir, 'skills', 'sandpiper', 'tasks', 'node_modules'))).toBe(false);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
