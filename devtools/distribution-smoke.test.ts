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
          'modes',
          'core',
          'dist',
          'packages/',
          'prompts/',
          'sandpiper',
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

  it('keeps the generated dist package manifest resolvable after distribution assembly', () => {
    const distPackageJsonPath = join(repoRoot, 'dist', 'package.json');
    const distPackageJson = JSON.parse(readFileSync(distPackageJsonPath, 'utf-8')) as PiPackageManifest;

    expect(findMissingPiManifestPaths(join(repoRoot, 'dist'), distPackageJson)).toEqual([]);
  });
});
