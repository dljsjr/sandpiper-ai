import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  configurePiEnvironment,
  defaultStandaloneMainArgs,
  findPackageRoot,
  mirrorPiSandpiperEnvironment,
  prepareStandalonePackageDir,
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

  it('uses explicit standalone resource and package directory overrides', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sandpiper-standalone-bootstrap-'));
    try {
      const resourceRoot = join(dir, 'resources');
      const packageDir = join(dir, 'bundle');
      mkdirSync(resourceRoot, { recursive: true });
      mkdirSync(packageDir, { recursive: true });

      const paths = resolveStandalonePaths({
        startDir: join(dir, 'ignored'),
        env: {
          SANDPIPER_STANDALONE_RESOURCE_ROOT: resourceRoot,
          SANDPIPER_STANDALONE_PACKAGE_DIR: packageDir,
        },
      });

      expect(paths.resourceRoot).toBe(resourceRoot);
      expect(paths.packageDir).toBe(packageDir);
      expect(paths.packageDirSource).toBe('override');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('defaults package metadata to the generated standalone package directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sandpiper-standalone-bootstrap-'));
    try {
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'sandpiper-ai' }));
      const nested = join(dir, 'packages', 'cli');
      mkdirSync(nested, { recursive: true });

      const paths = resolveStandalonePaths({
        startDir: nested,
        env: {},
      });

      expect(paths.resourceRoot).toBe(dir);
      expect(paths.packageDir).toBe(join(dir, 'dist', 'standalone-package'));
      expect(paths.packageDirSource).toBe('generated');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('prepares a generated package directory without root Pi resources', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sandpiper-standalone-bootstrap-'));
    try {
      const resourceRoot = join(dir, 'repo');
      const packageDir = join(dir, 'package');
      const piPackageDir = join(dir, 'pi');
      mkdirSync(join(resourceRoot, 'docs'), { recursive: true });
      mkdirSync(join(piPackageDir, 'dist', 'modes'), { recursive: true });
      mkdirSync(join(piPackageDir, 'dist', 'core'), { recursive: true });
      writeFileSync(
        join(resourceRoot, 'package.json'),
        JSON.stringify({
          name: 'sandpiper-ai',
          version: '1.2.3',
          piConfig: { name: 'sandpiper', configDir: '.sandpiper', bin: 'sandpiper' },
          pi: { extensions: ['./extensions/system.ts'] },
        }),
      );

      prepareStandalonePackageDir({ packageDir, resourceRoot, piPackageDir });

      const generated = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf-8')) as {
        version?: string;
        pi?: unknown;
        piConfig?: { name?: string; configDir?: string; bin?: string };
      };
      expect(generated.version).toBe('1.2.3');
      expect(generated.pi).toBeUndefined();
      expect(generated.piConfig).toEqual({ name: 'sandpiper', configDir: '.sandpiper', bin: 'sandpiper' });
      expect(existsSync(join(packageDir, 'docs'))).toBe(true);
      // shell-relay is temporarily disabled (df04a14d); its shell-integration symlink step is commented
      // out in prepareStandalonePackageDir, so it should not appear in the generated package.
      expect(existsSync(join(packageDir, 'extensions', 'shell-relay', 'shell-integration'))).toBe(false);
      expect(existsSync(join(packageDir, 'dist', 'modes'))).toBe(true);
      expect(existsSync(join(packageDir, 'dist', 'core'))).toBe(true);
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

    configurePiEnvironment(
      {
        packageDir: '/bundle',
        piPackageDir: '/pi-package',
        piVersion: '0.70.2',
      },
      env,
    );

    expect(env.PI_PACKAGE_DIR).toBe('/bundle');
    expect(env.PI_SKIP_VERSION_CHECK).toBe('1');
    expect(env.PI_CODING_AGENT_PACKAGE).toBe('/pi-package');
    expect(env.PI_CODING_AGENT_VERSION).toBe('0.70.2');
    expect(env.SANDPIPER_CODING_AGENT_PACKAGE).toBe('/bundle');
    expect(env.PI_TELEMETRY).toBe('0');
  });

  it.each([
    ['PI_TELEMETRY', '1'],
    ['SANDPIPER_TELEMETRY', '1'],
  ])('lets %s opt back in to Pi install telemetry', (key, value) => {
    const env: Record<string, string | undefined> = { [key]: value };

    configurePiEnvironment({ packageDir: '/bundle', piPackageDir: '/pi-package', piVersion: '0.70.2' }, env);
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
