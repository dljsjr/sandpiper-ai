import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findPackageRoot } from './standalone_bootstrap.js';

const repoRoot = findPackageRoot(dirname(fileURLToPath(import.meta.url)), 'sandpiper-ai-cli');
const bunExecutable = process.env.BUN_EXECUTABLE ?? 'bun';

function standaloneEnv(overrides: NodeJS.ProcessEnv & { SANDPIPER_CODING_AGENT_DIR: string }): NodeJS.ProcessEnv {
  const root = dirname(overrides.SANDPIPER_CODING_AGENT_DIR);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(PI|SANDPIPER)_/.test(key)));
  return {
    ...env,
    HOME: join(root, 'home'),
    XDG_CONFIG_HOME: join(root, 'config'),
    XDG_STATE_HOME: join(root, 'state'),
    XDG_CACHE_HOME: join(root, 'cache'),
    XDG_RUNTIME_DIR: join(root, 'runtime'),
    BUN_INSTALL: join(root, 'bun'),
    BUN_INSTALL_CACHE_DIR: join(root, 'bun-cache'),
    JITI_FS_CACHE: 'false',
    PI_OFFLINE: '1',
    PI_CODING_AGENT_DIR: overrides.SANDPIPER_CODING_AGENT_DIR,
    PI_CODING_AGENT_SESSION_DIR: join(root, 'sessions'),
    SANDPIPER_CODING_AGENT_SESSION_DIR: join(root, 'sessions'),
    AGENT_JOURNAL_DIR: join(root, 'journal'),
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    JJ_CONFIG: join(repoRoot, 'devtools', 'test-fixtures', 'jj-test-config.toml'),
    ...overrides,
  };
}

function runStandalone(args: readonly string[], env: NodeJS.ProcessEnv): string {
  return execFileSync(bunExecutable, ['run', '--bun', './packages/cli/sandpiper_standalone.ts', ...args], {
    cwd: repoRoot,
    encoding: 'utf-8',
    env,
  });
}

function runSandpiperBin(args: readonly string[], env: NodeJS.ProcessEnv): string {
  return execFileSync(bunExecutable, ['--no-install', './packages/cli/bin/sandpiper', ...args], {
    cwd: repoRoot,
    encoding: 'utf-8',
    env,
  });
}

function runStandaloneHelp(args: readonly string[] = []): string {
  const tempDir = mkdtempSync(join(tmpdir(), 'sandpiper-standalone-smoke-'));
  try {
    return runStandalone(
      ['--help', ...args],
      standaloneEnv({
        SANDPIPER_CODING_AGENT_DIR: join(tempDir, 'agent'),
      }),
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function countFlagLines(output: string, flag: string): number {
  return output.split('\n').filter((line) => line.trimStart().startsWith(flag)).length;
}

describe('standalone Sandpiper CLI smoke', () => {
  it('runs the normal sandpiper bin through the standalone runtime', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'sandpiper-bin-smoke-'));

    try {
      const output = runSandpiperBin(
        ['--help', '--no-extensions', '--no-skills', '--no-prompt-templates', '--no-themes', '--no-context-files'],
        standaloneEnv({
          SANDPIPER_CODING_AGENT_DIR: join(tempDir, 'agent'),
        }),
      );

      expect(output).toContain('--migrate-pi-configs');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }, 15_000);

  it('loads a user extension with a runtime Pi import through the built sandpiper bin', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'sandpiper-runtime-import-smoke-'));
    const extensionPath = join(tempDir, 'runtime-import-extension.ts');

    try {
      writeFileSync(
        extensionPath,
        `import { getMarkdownTheme } from '@earendil-works/pi-coding-agent';

export default function runtimeImportProbe(pi) {
  getMarkdownTheme();
  pi.registerFlag('runtime-import-probe', {
    description: 'Marker flag registered after a runtime Pi import',
    type: 'boolean',
    default: false,
  });
}
`,
      );

      const output = runSandpiperBin(
        ['--help', '-e', extensionPath, '--no-skills', '--no-prompt-templates', '--no-themes', '--no-context-files'],
        standaloneEnv({
          SANDPIPER_CODING_AGENT_DIR: join(tempDir, 'agent'),
        }),
      );

      expect(output).toContain('--runtime-import-probe');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }, 15_000);

  it('loads Sandpiper extension flags through the explicit standalone entrypoint', () => {
    const output = runStandaloneHelp([
      '--no-extensions',
      '--no-skills',
      '--no-prompt-templates',
      '--no-themes',
      '--no-context-files',
    ]);

    expect(output).toContain('--migrate-pi-configs');
  }, 15_000);

  it('loads Sandpiper extension flags exactly once by default', () => {
    const output = runStandaloneHelp();

    expect(countFlagLines(output, '--migrate-pi-configs')).toBe(1);
  });

  it('allows package-management commands to use persisted settings', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'sandpiper-standalone-smoke-'));
    const agentDir = join(tempDir, 'agent');
    const packageRoot = join(tempDir, 'third-party-package');

    try {
      mkdirSync(agentDir, { recursive: true });
      mkdirSync(packageRoot, { recursive: true });
      writeFileSync(join(packageRoot, 'package.json'), JSON.stringify({ name: 'third-party-package', pi: {} }));
      writeFileSync(join(agentDir, 'settings.json'), JSON.stringify({ packages: [packageRoot] }));

      const output = runStandalone(
        ['list'],
        standaloneEnv({
          SANDPIPER_CODING_AGENT_DIR: agentDir,
        }),
      );

      expect(output).toContain('User packages:');
      expect(output).toContain(packageRoot);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('configures Pi package metadata before importing Pi', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'sandpiper-package-metadata-'));
    const metadataPackageDir = join(tempDir, 'package');
    const expectedVersion = '9.8.7';

    try {
      mkdirSync(metadataPackageDir);
      writeFileSync(
        join(metadataPackageDir, 'package.json'),
        JSON.stringify({
          name: 'sandpiper-metadata-probe',
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
          SANDPIPER_STANDALONE_PACKAGE_DIR: metadataPackageDir,
          SANDPIPER_CODING_AGENT_DIR: join(tempDir, 'agent'),
        }),
      );

      // The startup diagnostic line printing this was removed: it broke Pi RPC mode, which
      // expects well-formed JSON-LD over stdout and can't tolerate arbitrary interleaved text.
      expect(output.trim().endsWith(expectedVersion)).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
