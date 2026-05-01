import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import rootPackageJson from '../package.json' with { type: 'json' };
import autotoonPackageJson from '../packages/capability-autotoon/package.json' with { type: 'json' };
import { findMissingPiManifestPaths } from './distribution-invariants.js';
import { assembleNeutralPiPackage, createNeutralPiPackageJson } from './neutralPiPackage.js';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

describe('neutral Pi package assembler', () => {
  it('creates a neutral package manifest without Sandpiper app identity', () => {
    const manifest = createNeutralPiPackageJson(rootPackageJson);

    expect(manifest).toMatchObject({
      name: 'sandpiper-ai-neutral-pi-package',
      version: rootPackageJson.version,
      type: 'module',
      keywords: ['pi-package'],
      pi: {
        extensions: [
          './extensions/capabilities.ts',
          './extensions/shell-relay',
          './extensions/web-fetch',
          './extensions/autotoon',
        ],
        skills: ['./skills/sandpiper', './skills/third-party'],
        prompts: ['./prompts'],
        themes: ['./themes'],
      },
    });
    expect(manifest.dependencies['@toon-format/toon']).toBe(autotoonPackageJson.dependencies['@toon-format/toon']);
    expect(manifest).not.toHaveProperty('piConfig');
    expect(manifest).not.toHaveProperty('bin');
  });

  it('assembles declared neutral package resources into an output directory', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'sandpiper-neutral-pi-package-'));

    try {
      const outputDir = join(tempDir, 'package');
      mkdirSync(join(repoRoot, 'extensions', 'shell-relay', 'node_modules', 'stale-package'), { recursive: true });
      await assembleNeutralPiPackage({ repoRoot, outputDir });

      const manifest = JSON.parse(readFileSync(join(outputDir, 'package.json'), 'utf-8')) as ReturnType<
        typeof createNeutralPiPackageJson
      >;

      expect(findMissingPiManifestPaths(outputDir, manifest)).toEqual([]);
      expect(existsSync(join(outputDir, 'extensions', 'system', 'neutral-capability-extension.ts'))).toBe(true);
      expect(existsSync(join(outputDir, 'extensions', 'system', 'extension-factories.ts'))).toBe(false);
      expect(existsSync(join(outputDir, 'extensions', 'system', 'migration-controls.ts'))).toBe(false);
      expect(existsSync(join(outputDir, 'extensions', 'shell-relay', 'src', 'preflight.test.ts'))).toBe(false);
      expect(existsSync(join(outputDir, 'extensions', 'shell-relay', 'node_modules'))).toBe(false);
      expect(existsSync(join(outputDir, 'packages', 'capability-autotoon', 'src', 'pi-extension.ts'))).toBe(true);
      expect(existsSync(join(outputDir, 'skills', 'sandpiper', 'tasks', 'SKILL.md'))).toBe(true);
    } finally {
      rmSync(join(repoRoot, 'extensions', 'shell-relay', 'node_modules'), { recursive: true, force: true });
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
