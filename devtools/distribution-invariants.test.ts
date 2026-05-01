import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
      "import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';",
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
    ].join('\n'),
    expectedPatternNames: ['Sandpiper migration flag', 'Sandpiper startup prompt hook', 'Sandpiper identity factory'],
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

  it('keeps the neutral Pi capability entrypoint free of Sandpiper identity wiring', () => {
    const matches = findForbiddenTextMatches(
      repoRoot,
      ['extensions/capabilities.ts'],
      NEUTRAL_CAPABILITY_ENTRYPOINT_FORBIDDEN_PATTERNS,
    );

    expect(matches).toEqual([]);
  });

  it('keeps legacy Pi package installation opt-in', () => {
    const postinstallScript = readFileSync(join(repoRoot, 'devtools', 'postinstall.sh'), 'utf-8');

    expect(postinstallScript).toContain('SANDPIPER_INSTALL_PI_PACKAGE:-0');
    expect(postinstallScript).toContain('Skipping legacy Pi package install');
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
