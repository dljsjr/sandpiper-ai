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
}

function readPackageJson(path: string): PackageMetadata {
  return JSON.parse(readFileSync(path, 'utf-8')) as PackageMetadata;
}

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
  it('declares a stable workspace bin for standalone dogfooding', () => {
    const rootPackage = readPackageJson(join(repoRoot, 'package.json'));
    const cliPackage = readPackageJson(join(repoRoot, 'packages', 'cli', 'package.json'));

    expect(rootPackage.dependencies?.['sandpiper-ai-cli']).toBe(rootPackage.version);
    expect(cliPackage.bin?.['sandpiper-standalone']).toBe('./bin/sandpiper-standalone');
    expect(existsSync(join(repoRoot, 'packages', 'cli', 'bin', 'sandpiper-standalone'))).toBe(true);
    expect(cliPackage.scripts?.preinstall).toContain('build:standalone');
  });

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

    try {
      mkdirSync(agentDir, { recursive: true });
      writeFileSync(join(agentDir, 'settings.json'), JSON.stringify({ packages: [join(repoRoot, 'dist')] }));

      const output = runStandalone(
        ['list'],
        standaloneEnv({
          SANDPIPER_CODING_AGENT_DIR: agentDir,
        }),
      );

      expect(output).toContain('User packages:');
      expect(output).toContain(join(repoRoot, 'dist'));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('loads installed third-party packages while avoiding duplicate legacy Sandpiper resources', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'sandpiper-standalone-smoke-'));
    const agentDir = join(tempDir, 'agent');
    const legacySandpiperPackage = join(tempDir, 'legacy-sandpiper-package');
    const thirdPartyPackage = join(tempDir, 'third-party-package');

    try {
      mkdirSync(join(legacySandpiperPackage, 'extensions'), { recursive: true });
      mkdirSync(join(thirdPartyPackage, 'extensions'), { recursive: true });
      mkdirSync(agentDir, { recursive: true });
      writeFileSync(
        join(legacySandpiperPackage, 'package.json'),
        JSON.stringify({ name: 'sandpiper-ai', pi: { extensions: ['./extensions/system.js'] } }),
      );
      writeFileSync(
        join(legacySandpiperPackage, 'extensions', 'system.js'),
        `export default function system(pi) {
  pi.registerFlag('migrate-pi-configs', {
    description: 'Marker flag registered by a legacy Sandpiper package',
    type: 'boolean',
    default: false,
  });
  pi.registerFlag('install-shell-integrations', {
    description: 'Marker flag registered by a legacy Sandpiper package',
    type: 'boolean',
    default: false,
  });
}
`,
      );
      writeFileSync(join(thirdPartyPackage, 'package.json'), JSON.stringify({ name: 'third-party-package' }));
      writeFileSync(
        join(thirdPartyPackage, 'extensions', 'probe.js'),
        `export default function probe(pi) {
  pi.registerFlag('third-party-probe', {
    description: 'Marker flag registered by an installed third-party package',
    type: 'boolean',
    default: false,
  });
}
`,
      );
      writeFileSync(
        join(agentDir, 'settings.json'),
        JSON.stringify({ packages: [legacySandpiperPackage, thirdPartyPackage] }),
      );

      const output = runStandalone(
        ['--help'],
        standaloneEnv({
          SANDPIPER_CODING_AGENT_DIR: agentDir,
        }),
      );

      expect(countFlagLines(output, '--migrate-pi-configs')).toBe(1);
      expect(countFlagLines(output, '--install-shell-integrations')).toBe(1);
      expect(countFlagLines(output, '--third-party-probe')).toBe(1);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
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

      expect(output).toContain('using pi-coding-agent version:');
      expect(output.trim().endsWith(expectedVersion)).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
