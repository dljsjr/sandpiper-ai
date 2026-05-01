import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findForbiddenTextMatches } from './distribution-invariants.js';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

describe('distribution source-boundary invariants', () => {
  it('keeps AutoTOON core free of host-specific adapter references', () => {
    const matches = findForbiddenTextMatches(
      repoRoot,
      ['packages/capability-autotoon/src/core.ts'],
      [
        { name: 'Sandpiper config reference', expression: /(?:~\/)?\.sandpiper|SANDPIPER_/ },
        { name: 'Pi config reference', expression: /(?:~\/)?\.pi|\bPI_|\bPi\b/ },
        { name: 'Pi adapter API', expression: /@mariozechner|ExtensionAPI|ToolDefinition/ },
        { name: 'MCP adapter API', expression: /@modelcontextprotocol|McpServer/ },
      ],
    );

    expect(matches).toEqual([]);
  });

  it('keeps the neutral Pi capability entrypoint free of Sandpiper identity wiring', () => {
    const matches = findForbiddenTextMatches(
      repoRoot,
      ['extensions/capabilities.ts'],
      [
        { name: 'Sandpiper migration flag', expression: /migrate-pi-configs|install-shell-integrations/ },
        { name: 'Sandpiper startup prompt hook', expression: /before_agent_start|buildSandpiperSystemPrompt/ },
        { name: 'Sandpiper identity factory', expression: /createSandpiperIdentityExtension/ },
      ],
    );

    expect(matches).toEqual([]);
  });

  it('keeps distribution smoke tests away from real user config directories', () => {
    const matches = findForbiddenTextMatches(
      repoRoot,
      [
        'packages/cli/standalone_cli_smoke.test.ts',
        'packages/cli/standalone_resource_discovery.test.ts',
        'packages/cli/standalone_bootstrap.test.ts',
      ],
      [
        { name: 'home directory API', expression: /\bhomedir\s*\(/ },
        { name: 'literal Sandpiper user config path', expression: /~\/\.sandpiper/ },
        { name: 'literal Pi user config path', expression: /~\/\.pi/ },
        { name: 'HOME environment access', expression: /process\.env\.HOME/ },
      ],
    );

    expect(matches).toEqual([]);
  });
});
