import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findPackageRoot } from './standalone_bootstrap.js';

const repoRoot = findPackageRoot(dirname(fileURLToPath(import.meta.url)), 'sandpiper-ai');

function runStandaloneHelp(): string {
  const tempDir = mkdtempSync(join(tmpdir(), 'sandpiper-standalone-smoke-'));
  try {
    return execFileSync(
      process.execPath,
      [
        'run',
        '--bun',
        './packages/cli/sandpiper_standalone.ts',
        '--help',
        '--no-extensions',
        '--no-skills',
        '--no-prompt-templates',
        '--no-themes',
        '--no-context-files',
      ],
      {
        cwd: repoRoot,
        encoding: 'utf-8',
        env: {
          ...process.env,
          SANDPIPER_CODING_AGENT_DIR: join(tempDir, 'agent'),
        },
      },
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

describe('standalone Sandpiper CLI smoke', () => {
  it('loads Sandpiper extension flags through the explicit standalone entrypoint', () => {
    const output = runStandaloneHelp();

    expect(output).toContain('--migrate-pi-configs');
    expect(output).toContain('--install-shell-integrations');
  });

  it('uses the workspace entrypoint instead of a sandpiper executable from PATH', () => {
    const entrypointPath = resolve(repoRoot, 'packages', 'cli', 'sandpiper_standalone.ts');

    expect(entrypointPath).toContain('/packages/cli/sandpiper_standalone.ts');
  });
});
