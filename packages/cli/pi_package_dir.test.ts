import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findPiPackageDir } from './pi_package_dir.js';

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

describe('findPiPackageDir', () => {
  it('uses generated dist package metadata when the source root is only a workspace package', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'sandpiper-pi-package-dir-'));

    try {
      mkdirSync(join(repoRoot, 'packages', 'cli', 'dist'), { recursive: true });
      mkdirSync(join(repoRoot, 'dist'), { recursive: true });
      writeJson(join(repoRoot, 'package.json'), { name: 'sandpiper-ai' });
      writeJson(join(repoRoot, 'packages', 'cli', 'package.json'), { name: 'sandpiper-ai-cli' });
      writeJson(join(repoRoot, 'dist', 'package.json'), {
        name: 'sandpiper-ai',
        pi: { extensions: ['./extensions/system.ts'] },
      });

      expect(findPiPackageDir(join(repoRoot, 'packages', 'cli', 'dist'))).toBe(join(repoRoot, 'dist'));
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('prefers the nearest package that already has Pi resource metadata', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'sandpiper-pi-package-dir-'));

    try {
      mkdirSync(join(repoRoot, 'dist'), { recursive: true });
      writeJson(join(repoRoot, 'package.json'), { name: 'sandpiper-ai' });
      writeJson(join(repoRoot, 'dist', 'package.json'), {
        name: 'sandpiper-ai',
        pi: { extensions: ['./extensions/system.ts'] },
      });

      expect(findPiPackageDir(join(repoRoot, 'dist'))).toBe(join(repoRoot, 'dist'));
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('throws when no Pi package metadata can be found', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'sandpiper-pi-package-dir-'));

    try {
      mkdirSync(join(repoRoot, 'packages', 'cli', 'dist'), { recursive: true });
      writeJson(join(repoRoot, 'package.json'), { name: 'not-sandpiper' });

      expect(() => findPiPackageDir(join(repoRoot, 'packages', 'cli', 'dist'))).toThrow(
        'Could not find a Pi package directory',
      );
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
