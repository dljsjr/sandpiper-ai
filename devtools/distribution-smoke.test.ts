import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import rootPackageJson from '../package.json' with { type: 'json' };
import { createDistPackageJson, type DistPackageJson, SANDPIPER_DIST_PI_RESOURCES } from './distPackageJson.js';
import { findMissingPiManifestPaths, materializePiManifestPaths } from './distribution-invariants.js';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

describe('Pi package distribution smoke', () => {
  it('keeps the source Pi package manifest internally resolvable', () => {
    expect(findMissingPiManifestPaths(repoRoot, rootPackageJson)).toEqual([]);
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
        piConfig: rootPackageJson.piConfig,
        keywords: rootPackageJson.keywords,
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
    const distPackageJson = JSON.parse(readFileSync(distPackageJsonPath, 'utf-8')) as typeof rootPackageJson;

    expect(findMissingPiManifestPaths(join(repoRoot, 'dist'), distPackageJson)).toEqual([]);
  });
});
