import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DISTRIBUTION_SMOKE_FORBIDDEN_PATTERNS,
  type ForbiddenTextPattern,
  findForbiddenTextMatches,
  HOST_NEUTRAL_CORE_FORBIDDEN_PATTERNS,
  NEUTRAL_CAPABILITY_ENTRYPOINT_FORBIDDEN_PATTERNS,
} from './distribution-invariants.js';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

interface PositivePatternCase {
  readonly name: string;
  readonly patterns: readonly ForbiddenTextPattern[];
  readonly content: string;
  readonly expectedPatternNames: readonly string[];
}

const positivePatternCases: readonly PositivePatternCase[] = [
  {
    name: 'host-neutral core patterns',
    patterns: HOST_NEUTRAL_CORE_FORBIDDEN_PATTERNS,
    content: [
      'const sandpiperSession = process.env.SANDPIPER_SESSION_ID;',
      'const piPackageDir = process.env.PI_PACKAGE_DIR;',
      "import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';",
      'class McpServer {}',
    ].join('\n'),
    expectedPatternNames: ['Sandpiper config reference', 'Pi config reference', 'Pi adapter API', 'MCP adapter API'],
  },
  {
    name: 'neutral capability entrypoint patterns',
    patterns: NEUTRAL_CAPABILITY_ENTRYPOINT_FORBIDDEN_PATTERNS,
    content: [
      "pi.registerFlag('migrate-pi-configs', {});",
      "pi.on('before_agent_start', buildSandpiperSystemPrompt);",
      'const factory = createSandpiperIdentityExtension();',
      "import { createNeutralCapabilityExtension } from './system/extension-factories.js';",
    ].join('\n'),
    expectedPatternNames: [
      'Sandpiper migration flag',
      'Sandpiper startup prompt hook',
      'Sandpiper identity factory',
      'composed identity/capability factory module',
    ],
  },
  {
    name: 'distribution smoke user-config patterns',
    patterns: DISTRIBUTION_SMOKE_FORBIDDEN_PATTERNS,
    content: [
      'const home = homedir();',
      "const sandpiperConfig = '~/.sandpiper';",
      "const piConfig = '~/.pi';",
      'const homeEnv = process.env.HOME;',
    ].join('\n'),
    expectedPatternNames: [
      'home directory API',
      'literal Sandpiper user config path',
      'literal Pi user config path',
      'HOME environment access',
    ],
  },
];

describe('distribution source-boundary invariants', () => {
  for (const patternCase of positivePatternCases) {
    it(`detects known violations for ${patternCase.name}`, () => {
      const tempDir = mkdtempSync(join(tmpdir(), 'sandpiper-distribution-invariant-'));

      try {
        writeFileSync(join(tempDir, 'violation.ts'), patternCase.content);

        const matches = findForbiddenTextMatches(tempDir, ['violation.ts'], patternCase.patterns);
        const patternNames = matches.map((match) => match.patternName);

        expect(patternNames).toEqual(expect.arrayContaining([...patternCase.expectedPatternNames]));
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });
  }

  it('keeps AutoTOON core free of host-specific adapter references', () => {
    const matches = findForbiddenTextMatches(
      repoRoot,
      ['packages/capability-autotoon/src/core.ts'],
      HOST_NEUTRAL_CORE_FORBIDDEN_PATTERNS,
    );

    expect(matches).toEqual([]);
  });

  it('keeps the neutral Pi capability entrypoints free of Sandpiper identity wiring', () => {
    const matches = findForbiddenTextMatches(
      repoRoot,
      [
        'plugins/pi/extensions/skill-loading.ts',
        'plugins/pi/extensions/turn-control.ts',
        'plugins/pi/extensions/context-management.ts',
        'plugins/pi/extensions/background-process.ts',
      ],
      NEUTRAL_CAPABILITY_ENTRYPOINT_FORBIDDEN_PATTERNS,
    );

    expect(matches).toEqual([]);
  });

  it('keeps dependency installation free of Sandpiper artifact lifecycle hooks', async () => {
    const rootPackageJson = (await import('../package.json', { with: { type: 'json' } })).default as {
      readonly scripts?: Record<string, string>;
    };

    expect(rootPackageJson.scripts).not.toHaveProperty('preinstall');
    expect(rootPackageJson.scripts).not.toHaveProperty('postinstall');
  });

  it('keeps distribution smoke tests away from real user config directories', () => {
    const matches = findForbiddenTextMatches(
      repoRoot,
      [
        'packages/cli/standalone_cli_smoke.test.ts',
        'packages/cli/standalone_resource_discovery.test.ts',
        'packages/cli/standalone_bootstrap.test.ts',
      ],
      DISTRIBUTION_SMOKE_FORBIDDEN_PATTERNS,
    );

    expect(matches).toEqual([]);
  });
});
