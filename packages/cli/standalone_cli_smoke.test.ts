import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findPackageRoot } from './standalone_bootstrap.js';

const repoRoot = findPackageRoot(dirname(fileURLToPath(import.meta.url)), 'sandpiper-ai');
const bunExecutable = process.env.BUN_EXECUTABLE ?? 'bun';

function standaloneEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env = { ...process.env, ...overrides };
  delete env.PI_PACKAGE_DIR;
  delete env.PI_CODING_AGENT_PACKAGE;
  delete env.PI_CODING_AGENT_VERSION;
  return env;
}

function runStandalone(args: readonly string[], env: NodeJS.ProcessEnv): string {
  return execFileSync(bunExecutable, ['run', '--bun', './packages/cli/sandpiper_standalone.ts', ...args], {
    cwd: repoRoot,
    encoding: 'utf-8',
    env,
  });
}

function runStandaloneHelp(): string {
  const tempDir = mkdtempSync(join(tmpdir(), 'sandpiper-standalone-smoke-'));
  try {
    return runStandalone(
      ['--help', '--no-extensions', '--no-skills', '--no-prompt-templates', '--no-themes', '--no-context-files'],
      standaloneEnv({
        SANDPIPER_CODING_AGENT_DIR: join(tempDir, 'agent'),
      }),
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

  it('configures Pi package metadata before importing Pi', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'sandpiper-standalone-sidecar-'));
    const sidecarPackageDir = join(tempDir, 'package');
    const expectedVersion = '9.8.7';

    try {
      mkdirSync(sidecarPackageDir);
      writeFileSync(
        join(sidecarPackageDir, 'package.json'),
        JSON.stringify({
          name: 'sandpiper-standalone-sidecar',
          version: expectedVersion,
          piConfig: {
            name: 'sandpiper',
            configDir: '.sandpiper',
            bin: 'sandpiper',
          },
        }),
      );

      const output = runStandalone(
        ['--version'],
        standaloneEnv({
          SANDPIPER_STANDALONE_RESOURCE_ROOT: repoRoot,
          SANDPIPER_STANDALONE_PACKAGE_DIR: sidecarPackageDir,
          SANDPIPER_CODING_AGENT_DIR: join(tempDir, 'agent'),
        }),
      );

      expect(output.trim()).toBe(expectedVersion);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
