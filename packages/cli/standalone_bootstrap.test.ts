import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  configurePiEnvironment,
  defaultStandaloneMainArgs,
  findPackageRoot,
  mirrorPiSandpiperEnvironment,
  resolveStandalonePaths,
} from './standalone_bootstrap.js';

describe('standalone bootstrap', () => {
  it('finds the nearest package root by package name', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sandpiper-standalone-bootstrap-'));
    try {
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'sandpiper-ai' }));
      const nested = join(dir, 'packages', 'cli');
      mkdirSync(nested, { recursive: true });
      expect(findPackageRoot(nested, 'sandpiper-ai')).toBe(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('uses the installed product root without a repository root', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sandpiper-installed-bootstrap-'));
    try {
      const packageDir = join(dir, 'node_modules', 'sandpiper-ai-cli');
      const startDir = join(packageDir, 'dist');
      mkdirSync(startDir, { recursive: true });
      const manifest = JSON.stringify({ name: 'sandpiper-ai-cli', version: '1.2.3' });
      writeFileSync(join(packageDir, 'package.json'), manifest);
      expect(resolveStandalonePaths({ startDir, env: {} })).toEqual({ packageDir });
      expect(readFileSync(join(packageDir, 'package.json'), 'utf8')).toBe(manifest);
      expect(existsSync(join(dir, 'dist', 'standalone-package'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('resolves source and built modules to the same real product metadata', () => {
    const packageDir = mkdtempSync(join(tmpdir(), 'sandpiper-source-bootstrap-'));
    try {
      const manifest = JSON.stringify({
        name: 'sandpiper-ai-cli',
        version: '1.2.3',
        piConfig: { name: 'sandpiper', configDir: '.sandpiper', bin: 'sandpiper' },
      });
      writeFileSync(join(packageDir, 'package.json'), manifest);
      for (const startDir of [join(packageDir, 'packages', 'cli'), join(packageDir, 'dist')]) {
        mkdirSync(startDir, { recursive: true });
        expect(resolveStandalonePaths({ startDir, env: {} })).toEqual({ packageDir });
        expect(readFileSync(join(packageDir, 'package.json'), 'utf8')).toBe(manifest);
      }
      expect(existsSync(join(packageDir, 'packages', 'cli', 'package.json'))).toBe(false);
    } finally {
      rmSync(packageDir, { recursive: true, force: true });
    }
  });

  it('does not fall back to an ancestor checkout', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sandpiper-missing-resources-'));
    try {
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'sandpiper-ai-cli' }));
      const packageDir = join(dir, 'node_modules', 'sandpiper-ai-cli');
      const startDir = join(packageDir, 'dist');
      mkdirSync(startDir, { recursive: true });
      writeFileSync(join(packageDir, 'package.json'), JSON.stringify({ name: 'sandpiper-ai-cli' }));
      expect(resolveStandalonePaths({ startDir, env: {} })).toEqual({ packageDir });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('accepts an existing package directory override without generating files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sandpiper-bootstrap-overrides-'));
    try {
      const packageDir = join(dir, 'metadata');
      mkdirSync(packageDir);
      const paths = resolveStandalonePaths({
        startDir: join(dir, 'ignored'),
        env: { SANDPIPER_STANDALONE_PACKAGE_DIR: packageDir },
      });
      expect(paths).toEqual({ packageDir });
      expect(existsSync(join(packageDir, 'package.json'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('anchors the product root to an explicit metadata package instead of the module location', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sandpiper-package-override-'));
    try {
      const packageDir = join(dir, 'metadata');
      mkdirSync(packageDir);
      const paths = resolveStandalonePaths({
        startDir: join(dir, 'unrelated', 'dist'),
        env: { SANDPIPER_STANDALONE_PACKAGE_DIR: packageDir },
      });
      expect(paths).toEqual({ packageDir });
      expect(existsSync(join(packageDir, 'package.json'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('preserves Pi CLI arguments', () => {
    expect(defaultStandaloneMainArgs(['--help'], {})).toEqual(['--help']);
    expect(defaultStandaloneMainArgs(['--help', '--skill', '/tmp/skill'], {})).toEqual([
      '--help',
      '--skill',
      '/tmp/skill',
    ]);
    expect(defaultStandaloneMainArgs(['install', 'npm:@example/pkg'], {})).toEqual(['install', 'npm:@example/pkg']);
  });

  it('sets Pi environment before importing Pi', () => {
    const env: Record<string, string | undefined> = {};
    configurePiEnvironment({ packageDir: '/bundle', piPackageDir: '/pi-package', piVersion: '1.3.0' }, env);
    expect(env.PI_PACKAGE_DIR).toBe('/bundle');
    expect(env.PI_SKIP_VERSION_CHECK).toBe('1');
    expect(env.PI_CODING_AGENT_PACKAGE).toBe('/pi-package');
    expect(env.PI_CODING_AGENT_VERSION).toBe('1.3.0');
    expect(env.SANDPIPER_CODING_AGENT_PACKAGE).toBe('/bundle');
    expect(env.PI_TELEMETRY).toBe('0');
  });

  it('keeps the default Journal directory anchored to launch cwd in child processes', () => {
    const root = mkdtempSync(join(tmpdir(), 'sandpiper-journal-env-'));
    try {
      const env: NodeJS.ProcessEnv = {};
      configurePiEnvironment({ packageDir: '/bundle', piPackageDir: '/pi-package', piVersion: '1.3.0' }, env);
      const journalDir = join(process.cwd(), '.sandpiper');
      expect(env.AGENT_JOURNAL_DIR).toBe(journalDir);
      const childValue = execFileSync(process.execPath, ['-e', 'console.log(process.env.AGENT_JOURNAL_DIR)'], {
        cwd: root,
        env,
        encoding: 'utf8',
      });
      expect(childValue.trim()).toBe(journalDir);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each(['/custom/notes', '../relative-notes', ''])('preserves the supplied Journal directory %j', (value) => {
    const env: NodeJS.ProcessEnv = { AGENT_JOURNAL_DIR: value };
    configurePiEnvironment({ packageDir: '/bundle', piPackageDir: '/pi-package', piVersion: '1.3.0' }, env);
    expect(env.AGENT_JOURNAL_DIR).toBe(value);
  });

  it.each([
    ['PI_TELEMETRY', '1'],
    ['SANDPIPER_TELEMETRY', '1'],
  ])('lets %s opt back in to Pi install telemetry', (key, value) => {
    const env: Record<string, string | undefined> = { [key]: value };
    configurePiEnvironment({ packageDir: '/bundle', piPackageDir: '/pi-package', piVersion: '1.3.0' }, env);
    mirrorPiSandpiperEnvironment(env);
    expect(env.PI_TELEMETRY).toBe('1');
  });

  it('mirrors user-facing Pi and Sandpiper environment variables', () => {
    const env: Record<string, string | undefined> = {
      PI_OFFLINE: '1',
      PI_FOO: 'pi-value',
      SANDPIPER_FOO: 'sandpiper-value',
      SANDPIPER_BAR: 'bar-value',
      SANDPIPER_CODING_AGENT_PACKAGE: '/sandpiper-package',
      PI_CODING_AGENT_PACKAGE: '/pi-package',
      PI_PACKAGE_DIR: '/explicit-package-dir',
    };
    mirrorPiSandpiperEnvironment(env);
    expect(env.SANDPIPER_OFFLINE).toBe('1');
    expect(env.PI_FOO).toBe('sandpiper-value');
    expect(env.SANDPIPER_FOO).toBe('sandpiper-value');
    expect(env.PI_BAR).toBe('bar-value');
    expect(env.PI_CODING_AGENT_PACKAGE).toBe('/pi-package');
    expect(env.SANDPIPER_CODING_AGENT_PACKAGE).toBe('/sandpiper-package');
    expect(env.SANDPIPER_PACKAGE_DIR).toBeUndefined();
  });
});
