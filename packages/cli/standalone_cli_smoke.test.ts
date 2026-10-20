import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findPackageRoot } from './standalone_bootstrap.js';

const repoRoot = findPackageRoot(dirname(fileURLToPath(import.meta.url)), 'sandpiper-ai');
const bunExecutable = process.env.BUN_EXECUTABLE ?? 'bun';

interface PackageMetadata {
  readonly version?: string;
  readonly bin?: Record<string, string>;
  readonly dependencies?: Record<string, string>;
  readonly scripts?: Record<string, string>;
  readonly bundledDependencies?: readonly string[];
  readonly piConfig?: { readonly name: string; readonly configDir: string; readonly bin: string };
  readonly files?: readonly string[];
}

function readPackageJson(path: string): PackageMetadata {
  return JSON.parse(readFileSync(path, 'utf-8')) as PackageMetadata;
}

function standaloneEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env = { ...process.env, ...overrides };
  delete env.PI_PACKAGE_DIR;
  delete env.PI_CODING_AGENT_PACKAGE;
  delete env.PI_CODING_AGENT_VERSION;
  delete env.SANDPIPER_CODING_AGENT_PACKAGE;
  return env;
}

function runStandalone(args: readonly string[], env: NodeJS.ProcessEnv): string {
  return execFileSync(bunExecutable, ['run', '--bun', './packages/cli/sandpiper_standalone.ts', ...args], {
    cwd: repoRoot,
    encoding: 'utf-8',
    env,
  });
}

function runSandpiperBin(args: readonly string[], env: NodeJS.ProcessEnv): string {
  return execFileSync(bunExecutable, ['./packages/cli/bin/sandpiper', ...args], {
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
  it('declares stable workspace bins for the Sandpiper runtime', () => {
    const rootPackage = readPackageJson(join(repoRoot, 'package.json'));
    const cliPackage = readPackageJson(join(repoRoot, 'packages', 'cli', 'package.json'));

    expect(rootPackage.dependencies?.['sandpiper-ai-cli']).toBe('workspace:*');
    expect(cliPackage.bin?.sandpiper).toBe('./bin/sandpiper');
    expect(cliPackage.bin?.['sandpiper-system-prompt']).toBe('./bin/sandpiper-system-prompt');
    expect(cliPackage.bin).not.toHaveProperty('sandpiper-standalone');
    expect(existsSync(join(repoRoot, 'packages', 'cli', 'bin', 'sandpiper'))).toBe(true);
    expect(existsSync(join(repoRoot, 'packages', 'cli', 'bin', 'sandpiper-system-prompt'))).toBe(true);
    expect(existsSync(join(repoRoot, 'packages', 'cli', 'bin', 'sandpiper-standalone'))).toBe(false);
    expect(cliPackage.scripts).not.toHaveProperty('preinstall');
    expect(cliPackage.scripts?.build).toContain('build:standalone');
    expect(cliPackage.scripts).not.toHaveProperty('build:sandpiper');
    expect(cliPackage.scripts).not.toHaveProperty('build:system-prompt');
    expect(cliPackage.scripts?.['build:standalone']).toContain("--external '@earendil-works/*'");
    expect(cliPackage.scripts?.['build:standalone']).toContain("--external '@mariozechner/*'");
    expect(cliPackage.scripts?.['build:standalone']).toContain('--splitting');
    expect(cliPackage.piConfig).toEqual({ name: 'sandpiper', configDir: '.sandpiper', bin: 'sandpiper' });
    expect(cliPackage.files).toEqual(expect.arrayContaining(['bin/', 'dist/standalone/', 'docs/']));
    expect(cliPackage.bundledDependencies).toEqual(
      expect.arrayContaining([
        '@earendil-works/pi-coding-agent',
        '@earendil-works/pi-ai',
        '@earendil-works/pi-tui',
        'better-sqlite3',
        'jsdom',
      ]),
    );
    expect(cliPackage.dependencies?.['better-sqlite3']).toBe('13.0.3');
    expect(cliPackage.dependencies?.jsdom).toBe('30.0.1');
  });

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
      expect(output).toContain('--install-shell-integrations');
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
    expect(output).toContain('--install-shell-integrations');
  }, 15_000);

  it('loads Sandpiper extension flags exactly once by default', () => {
    const output = runStandaloneHelp();

    expect(countFlagLines(output, '--migrate-pi-configs')).toBe(1);
    expect(countFlagLines(output, '--install-shell-integrations')).toBe(1);
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

  it('uses the workspace entrypoint instead of a sandpiper executable from PATH', () => {
    const entrypointPath = resolve(repoRoot, 'packages', 'cli', 'sandpiper_standalone.ts');

    expect(entrypointPath).toContain('/packages/cli/sandpiper_standalone.ts');
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
          SANDPIPER_STANDALONE_RESOURCE_ROOT: join(repoRoot, 'packages', 'resources'),
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
