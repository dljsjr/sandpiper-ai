#!/usr/bin/env node

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
