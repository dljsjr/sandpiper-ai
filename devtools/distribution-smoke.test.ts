import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import rootPackageJson from '../package.json' with { type: 'json' };
import { createDistPackageJson, type DistPackageJson, SANDPIPER_DIST_PI_RESOURCES } from './distPackageJson.js';
import {
  findMissingPiManifestPaths,
  materializePiManifestPaths,
  type PiPackageManifest,
} from './distribution-invariants.js';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function expectProviderOwnedRootPiManifest(packageJson: typeof rootPackageJson): void {
  const rootPackage = packageJson as {
    readonly pi?: Partial<Record<'extensions' | 'skills' | 'prompts' | 'themes', readonly string[]>>;
  };

  for (const entries of Object.values(rootPackage.pi ?? {})) {
    for (const entry of entries ?? []) {
      expect(entry).not.toMatch(/^\.\/?(?:extensions|skills|prompts|themes)(?:\/|$)/);
      expect(entry).toMatch(/^\.\/(?:plugins\/pi|packages\/resources)(?:\/|$)/);
    }
  }
}

describe('Pi package distribution smoke', () => {
  it('keeps root Pi package routing provider-owned', () => {
    expectProviderOwnedRootPiManifest(rootPackageJson);
    expect(rootPackageJson.pi).toEqual({
      extensions: ['./plugins/pi/extensions'],
      skills: ['./packages/resources/skills/sandpiper', './packages/resources/skills/third-party'],
      prompts: ['./packages/resources/prompts'],
      themes: ['./packages/resources/themes'],
    });
    expect(rootPackageJson.piConfig).toEqual({ name: 'sandpiper', configDir: '.sandpiper', bin: 'sandpiper' });
    expect(rootPackageJson.bin).toEqual({ sandpiper: './packages/cli/bin/sandpiper' });
    expect(rootPackageJson).not.toHaveProperty('files');
    expect(findMissingPiManifestPaths(repoRoot, rootPackageJson)).toEqual([]);
  });

  it('uses the source root as the neutral Pi install surface instead of building a generated neutral package', () => {
    expect(rootPackageJson.scripts).not.toHaveProperty('build:neutral-pi-package');
    expect(rootPackageJson.scripts).not.toHaveProperty('test:neutral-pi-package');
    expect(rootPackageJson.scripts['prepare:distribution']).not.toContain('neutral-pi-package');
    expect(rootPackageJson.scripts['test:distribution']).not.toContain('neutralPiPackage');
  });

  it('generates Sandpiper Pi metadata without requiring root package Pi metadata', () => {
    const rootWithoutPiMetadata = {
      ...rootPackageJson,
      keywords: undefined,
      pi: undefined,
      piConfig: undefined,
    };

    expect(createDistPackageJson(rootWithoutPiMetadata)).toMatchObject({
      piConfig: {
        name: 'sandpiper',
        configDir: '.sandpiper',
        bin: 'sandpiper',
      },
      keywords: ['pi-package'],
      pi: SANDPIPER_DIST_PI_RESOURCES,
    } satisfies Partial<DistPackageJson>);
  });

  it('generates a distribution manifest whose declared resources resolve under a package root', () => {
    const packageRoot = mkdtempSync(join(tmpdir(), 'sandpiper-dist-manifest-'));

    try {
      const distPackageJson = createDistPackageJson(rootPackageJson);
      materializePiManifestPaths(packageRoot, distPackageJson);

      expect(distPackageJson).toMatchObject({
        name: rootPackageJson.name,
        version: rootPackageJson.version,
        piConfig: {
          name: 'sandpiper',
          configDir: '.sandpiper',
          bin: 'sandpiper',
        },
        keywords: ['pi-package'],
        pi: SANDPIPER_DIST_PI_RESOURCES,
        license: rootPackageJson.license,
        files: [
          'config/',
          'extensions/',
          'dist/',
          'packages/',
          'prompts/',
          'docs/',
          'sandpiper',
          'README.md',
          'skills/',
          'themes/',
        ],
        bin: { sandpiper: './sandpiper' },
      });
      expect(findMissingPiManifestPaths(packageRoot, distPackageJson)).toEqual([]);
    } finally {
      rmSync(packageRoot, { recursive: true, force: true });
    }
  });

  it('generates a Node-compatible Dash CLI wrapper and CommonJS sidecar', () => {
    const dashScriptsDir = join(repoRoot, 'dist', 'skills', 'sandpiper', 'dash', 'scripts');
    const dashBin = join(dashScriptsDir, 'dash');
    const dashSidecar = join(dashScriptsDir, 'dash.cjs');

    expect(readFileSync(dashBin, 'utf-8')).toBe("#!/usr/bin/env node\nimport './dash.cjs';\n");
    expect(readFileSync(dashSidecar, 'utf-8')).toContain('require(');
    expect(execFileSync(dashBin, ['--help'], { encoding: 'utf-8' })).toContain('Usage:');
  });

  it('keeps the generated dist package manifest resolvable after distribution assembly', () => {
    const distPackageJsonPath = join(repoRoot, 'dist', 'package.json');
    const distPackageJson = JSON.parse(readFileSync(distPackageJsonPath, 'utf-8')) as PiPackageManifest;

    expect(findMissingPiManifestPaths(join(repoRoot, 'dist'), distPackageJson)).toEqual([]);
  });
});
