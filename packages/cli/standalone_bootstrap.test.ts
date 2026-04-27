import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { configurePiEnvironment, findPackageRoot, resolveStandalonePaths } from './standalone_bootstrap.js';

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
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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
  });
});
