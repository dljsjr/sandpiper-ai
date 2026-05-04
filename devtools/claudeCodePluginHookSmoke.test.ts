import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const hookPath = join(repoRoot, 'dist', 'claude-plugin', 'hooks', 'autotoon-post-tool-use.js');

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

describe('Claude plugin bundled AutoTOON hook smoke', () => {
  beforeAll(() => {
    execFileSync('bun', ['--bun', 'devtools/claudeCodePlugin.ts', '--build'], { cwd: repoRoot, stdio: 'pipe' });
  }, 15_000);

  it('rewrites PostToolUse output through the bundled hook artifact', () => {
    expect(existsSync(hookPath)).toBe(true);

    const stdout = execFileSync('node', [hookPath], {
      cwd: repoRoot,
      encoding: 'utf-8',
      input: JSON.stringify({
        hook_event_name: 'PostToolUse',
        tool_response: longJsonFixture(),
      }),
    });

    const output = JSON.parse(stdout) as {
      readonly hookSpecificOutput?: {
        readonly hookEventName?: string;
        readonly updatedToolOutput?: unknown;
      };
    };

    expect(output.hookSpecificOutput).toMatchObject({
      hookEventName: 'PostToolUse',
      updatedToolOutput: expect.stringContaining('[TOON]\n'),
    });
  });

  it('does not bundle the previous AutoTOON MCP server artifact', () => {
    expect(existsSync(join(repoRoot, 'dist', 'claude-plugin', '.mcp.json'))).toBe(false);
    expect(existsSync(join(repoRoot, 'dist', 'claude-plugin', 'servers', 'sandpiper-claude-mcp.js'))).toBe(false);
    expect(
      readFileSync(join(repoRoot, 'dist', 'claude-plugin', '.claude-plugin', 'plugin.json'), 'utf-8'),
    ).not.toContain('mcpServers');
  });
});
