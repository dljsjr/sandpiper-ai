import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import rootPackageJson from '../package.json' with { type: 'json' };
import { assembleStandaloneSandpiperApp, createStandaloneSandpiperAppPackageJson } from './standaloneSandpiperApp.js';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

describe('standalone Sandpiper app assembler', () => {
  it('creates Sandpiper package metadata without Pi resource manifest entries', () => {
    const manifest = createStandaloneSandpiperAppPackageJson(rootPackageJson);

    expect(manifest).toMatchObject({
      name: 'sandpiper-ai-standalone-app',
      version: rootPackageJson.version,
      private: true,
      type: 'module',
      piCodingAgentVersion: rootPackageJson.workspaces.catalogs.pi['@mariozechner/pi-coding-agent'],
      piConfig: {
        name: 'sandpiper',
        configDir: '.sandpiper',
        bin: 'sandpiper',
      },
    });
    expect(manifest).not.toHaveProperty('pi');
    expect(manifest).not.toHaveProperty('bin');
  });

  it('assembles app-bundle metadata, resources, support packages, and Pi assets', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'sandpiper-standalone-app-'));

    try {
      const outputDir = join(tempDir, 'app');
      const piPackageDir = join(tempDir, 'pi-package');
      mkdirSync(join(piPackageDir, 'dist', 'modes'), { recursive: true });
      mkdirSync(join(piPackageDir, 'dist', 'core'), { recursive: true });
      writeFileSync(join(piPackageDir, 'dist', 'modes', 'mode.txt'), 'mode');
      writeFileSync(join(piPackageDir, 'dist', 'core', 'core.txt'), 'core');
      mkdirSync(join(repoRoot, 'extensions', 'shell-relay', 'node_modules', 'stale-package'), { recursive: true });

      await assembleStandaloneSandpiperApp({ repoRoot, outputDir, piPackageDir });

      const manifest = JSON.parse(readFileSync(join(outputDir, 'package.json'), 'utf-8')) as ReturnType<
        typeof createStandaloneSandpiperAppPackageJson
      >;

      expect(manifest.piConfig).toEqual({ name: 'sandpiper', configDir: '.sandpiper', bin: 'sandpiper' });
      expect(existsSync(join(outputDir, 'skills', 'sandpiper', 'tasks', 'SKILL.md'))).toBe(true);
      expect(existsSync(join(outputDir, 'prompts', 'new-feature.md'))).toBe(true);
      expect(existsSync(join(outputDir, 'themes', 'README.md'))).toBe(true);
      expect(existsSync(join(outputDir, 'packages', 'core', 'src', 'host-context.ts'))).toBe(true);
      expect(existsSync(join(outputDir, 'packages', 'capability-autotoon', 'src', 'pi-extension.ts'))).toBe(true);
      expect(existsSync(join(outputDir, 'extensions', 'shell-relay', 'src', 'preflight.test.ts'))).toBe(false);
      expect(existsSync(join(outputDir, 'extensions', 'shell-relay', 'node_modules'))).toBe(false);
      expect(existsSync(join(outputDir, 'dist', 'modes', 'mode.txt'))).toBe(true);
      expect(existsSync(join(outputDir, 'dist', 'core', 'core.txt'))).toBe(true);
    } finally {
      rmSync(join(repoRoot, 'extensions', 'shell-relay', 'node_modules'), { recursive: true, force: true });
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
