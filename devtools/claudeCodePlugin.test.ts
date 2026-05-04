import { describe, expect, it } from 'vitest';
import rootPackageJson from '../package.json' with { type: 'json' };
import { createClaudePluginManifest, createClaudePluginMcpConfig } from './claudeCodePlugin.js';

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
          args: ['${CLAUDE_PLUGIN_ROOT}/servers/sandpiper-claude-mcp.js'],
          env: {
            SANDPIPER_CLAUDE_PLUGIN_ROOT: '${CLAUDE_PLUGIN_ROOT}',
            SANDPIPER_CLAUDE_PLUGIN_DATA: '${CLAUDE_PLUGIN_DATA}',
          },
        },
      },
    });
  });
});
