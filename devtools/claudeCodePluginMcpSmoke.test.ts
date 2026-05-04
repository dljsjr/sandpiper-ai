import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { beforeAll, describe, expect, it } from 'vitest';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const serverPath = join(repoRoot, 'dist', 'claude-plugin', 'servers', 'sandpiper-claude-mcp.js');

function longJsonFixture(): string {
  return JSON.stringify(
    Array.from({ length: 16 }, (_, index) => ({
      id: index,
      name: `fixture-${index}`,
      status: 'active',
      owner: 'sandpiper',
    })),
  );
}

describe('Claude plugin bundled MCP server smoke', () => {
  beforeAll(() => {
    execFileSync('bun', ['--bun', 'devtools/claudeCodePlugin.ts', '--build'], { cwd: repoRoot, stdio: 'pipe' });
  }, 15_000);

  it('serves the AutoTOON tool over stdio from the plugin artifact', async () => {
    expect(existsSync(serverPath)).toBe(true);

    const client = new Client({ name: 'sandpiper-claude-plugin-smoke', version: '0.0.1' });
    const transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath],
      cwd: repoRoot,
      stderr: 'pipe',
    });

    try {
      await client.connect(transport);

      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toContain('convert_json_to_toon');

      const result = await client.callTool({
        name: 'convert_json_to_toon',
        arguments: { json: longJsonFixture() },
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({ converted: true, format: 'toon' });
    } finally {
      await client.close();
    }
  }, 10_000);
});
