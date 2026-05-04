import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  findMissingFileDependencyTargets,
  findUnsupportedDependencySpecs,
  readPackageJson,
} from './ecosystemPackage.js';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function npmPackDryRun(packageDir: string): readonly string[] {
  const output = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: packageDir,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const result = JSON.parse(output) as readonly [{ readonly files: readonly { readonly path: string }[] }];
  return result[0].files.map((file) => file.path);
}

describe('ecosystem package artifacts', () => {
  it('emits a publishable Sandpiper Pi/npm package at dist/', () => {
    const packageDir = join(repoRoot, 'dist');
    const packageJson = readPackageJson(join(packageDir, 'package.json'));

    expect(packageJson.private).toBeUndefined();
    expect(packageJson.type).toBe('module');
    expect(packageJson.bin).toEqual({ sandpiper: './sandpiper' });
    expect(packageJson.dependencies).toMatchObject({
      '@mozilla/readability': expect.any(String),
      '@toon-format/toon': expect.any(String),
      jsdom: expect.any(String),
      'sandpiper-ai-core': 'file:./packages/core',
      'sandpiper-capability-autotoon': 'file:./packages/capability-autotoon',
      turndown: expect.any(String),
    });
    expect(packageJson.peerDependencies).toMatchObject({
      '@mariozechner/pi-coding-agent': '*',
      '@mariozechner/pi-tui': '*',
      '@sinclair/typebox': '*',
    });
    expect(findUnsupportedDependencySpecs(packageDir)).toEqual([]);
    expect(findMissingFileDependencyTargets(packageDir)).toEqual([]);
    expect(existsSync(join(packageDir, 'packages', 'core', 'package.json'))).toBe(true);
    expect(existsSync(join(packageDir, 'packages', 'capability-autotoon', 'package.json'))).toBe(true);
    expect(npmPackDryRun(packageDir)).toContain('package.json');
  });

  it('emits a publishable neutral Pi package artifact', () => {
    const packageDir = join(repoRoot, 'dist', 'neutral-pi-package');
    const packageJson = readPackageJson(join(packageDir, 'package.json'));

    expect(packageJson.private).toBeUndefined();
    expect(packageJson.type).toBe('module');
    expect(packageJson.keywords).toContain('pi-package');
    expect(packageJson.dependencies).toMatchObject({
      'sandpiper-ai-core': 'file:./packages/core',
      'sandpiper-capability-autotoon': 'file:./packages/capability-autotoon',
    });
    expect(packageJson).not.toHaveProperty('piConfig');
    expect(packageJson).not.toHaveProperty('bin');
    expect(findUnsupportedDependencySpecs(packageDir)).toEqual([]);
    expect(findMissingFileDependencyTargets(packageDir)).toEqual([]);
    expect(npmPackDryRun(packageDir)).toContain('package.json');
  });

  it('does not leak development scratch files into generated skill packages', () => {
    for (const packageDir of [join(repoRoot, 'dist'), join(repoRoot, 'dist', 'neutral-pi-package')]) {
      expect(readFileSync(join(packageDir, 'skills', 'sandpiper', 'jj', 'SKILL.md'), 'utf-8')).toContain('name: jj');
      expect(existsSync(join(packageDir, 'skills', 'sandpiper', 'jj-workspace', 'run_loop.log'))).toBe(false);
      expect(existsSync(join(packageDir, 'skills', 'sandpiper', 'jj-workspace', 'run_loop.pid'))).toBe(false);
    }
  });
});
