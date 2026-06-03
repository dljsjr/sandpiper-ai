import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  findMissingFileDependencyTargets,
  findNonExactDependencySpecs,
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

function expectRootPiManifestRoutesToProviderOwnedPaths(packageJson: ReturnType<typeof readPackageJson>): void {
  const rootPiManifest = packageJson.pi as
    | Partial<Record<'extensions' | 'skills' | 'prompts' | 'themes', readonly string[]>>
    | undefined;

  for (const entries of Object.values(rootPiManifest ?? {})) {
    for (const entry of entries ?? []) {
      expect(entry).not.toMatch(/^\.\/?(?:extensions|skills|prompts|themes)(?:\/|$)/);
      expect(entry).toMatch(/^\.\/(?:plugins\/pi|packages\/resources)(?:\/|$)/);
    }
  }
}

describe('ecosystem package artifacts', () => {
  it('keeps the repository root npm-installable with only provider-owned Pi package routing', () => {
    const packageJson = readPackageJson(join(repoRoot, 'package.json'));

    expectRootPiManifestRoutesToProviderOwnedPaths(packageJson);
    expect(findUnsupportedDependencySpecs(repoRoot)).toEqual([]);
    expect(findNonExactDependencySpecs(repoRoot, { localWorkspaceProtocolPackageNames: ['sandpiper-ai'] })).toEqual([]);
  });

  it('keeps shared resource source package-owned', () => {
    expect(existsSync(join(repoRoot, 'packages', 'resources', 'skills', 'sandpiper', 'tasks', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(repoRoot, 'packages', 'resources', 'prompts', 'new-feature.md'))).toBe(true);
    expect(existsSync(join(repoRoot, 'packages', 'resources', 'themes', 'README.md'))).toBe(true);

    for (const legacyRoot of ['skills', 'prompts', 'themes']) {
      expect(existsSync(join(repoRoot, legacyRoot))).toBe(false);
    }
  });

  it('keeps the standalone Trail package ready for publishable packaging', () => {
    const packageDir = join(repoRoot, 'packages', 'trail');
    const packageJson = readPackageJson(join(packageDir, 'package.json'));

    expect(packageJson.name).toBe('@sandpiper-ai/trail');
    expect(packageJson.private).toBeUndefined();
    expect(packageJson.type).toBe('module');
    expect(packageJson.bin).toEqual({ trail: './dist/trail' });
    expect(packageJson.files).toEqual(['README.md', 'docs/', 'dist/trail']);
    expect(packageJson.publishConfig).toEqual({ access: 'public' });
    expect(findUnsupportedDependencySpecs(packageDir)).toEqual([]);
    expect(findNonExactDependencySpecs(packageDir)).toEqual([]);
    expect(existsSync(join(packageDir, 'docs', 'README.md'))).toBe(true);

    const packedFiles = npmPackDryRun(packageDir);
    expect(packedFiles).toEqual(
      expect.arrayContaining([
        'package.json',
        'README.md',
        'docs/README.md',
        'docs/commands.md',
        'docs/getting-started.md',
        'docs/storage.md',
        'docs/task-format.md',
        'docs/workflows.md',
        'dist/trail',
      ]),
    );
    expect(packedFiles).not.toContain('dist/sandpiper-tasks');
  });

  it('emits a publishable Sandpiper Pi/npm package at dist/', () => {
    const packageDir = join(repoRoot, 'dist');
    const rootPackageJson = readPackageJson(join(repoRoot, 'package.json'));
    const packageJson = readPackageJson(join(packageDir, 'package.json'));

    expect(packageJson.private).toBeUndefined();
    expect(packageJson.type).toBe('module');
    expect(packageJson.bin).toEqual({
      sandpiper: './sandpiper',
      'sandpiper-tasks': './sandpiper-tasks',
      trail: './trail',
    });
    expect(packageJson.dependencies).toMatchObject({
      '@earendil-works/pi-coding-agent': expect.any(String),
      '@mozilla/readability': expect.any(String),
      '@toon-format/toon': expect.any(String),
      jsdom: expect.any(String),
      'sandpiper-ai-core': 'file:./packages/core',
      'sandpiper-capability-autotoon': 'file:./packages/capability-autotoon',
      turndown: expect.any(String),
    });
    expect(packageJson.peerDependencies).toMatchObject(rootPackageJson.peerDependencies ?? {});
    expect(packageJson.files).toEqual([
      'chunks/',
      'extensions/',
      'dist/',
      'packages/',
      'prompts/',
      'docs/',
      'sandpiper',
      'sandpiper-tasks',
      'trail',
      'README.md',
      'skills/',
      'skills-on-demand/',
      'themes/',
    ]);
    expect(findUnsupportedDependencySpecs(packageDir)).toEqual([]);
    expect(findNonExactDependencySpecs(packageDir)).toEqual([]);
    expect(findMissingFileDependencyTargets(packageDir)).toEqual([]);
    expect(existsSync(join(packageDir, 'packages', 'core', 'package.json'))).toBe(true);
    expect(existsSync(join(packageDir, 'packages', 'capability-autotoon', 'package.json'))).toBe(true);
    expect(existsSync(join(packageDir, 'extensions', 'system', 'package.json'))).toBe(true);
    expect(existsSync(join(packageDir, 'docs', 'README.md'))).toBe(true);
    expect(existsSync(join(packageDir, '.sandpiper'))).toBe(false);
    const packedFiles = npmPackDryRun(packageDir);
    expect(packedFiles).toEqual(
      expect.arrayContaining([
        'package.json',
        'sandpiper',
        expect.stringMatching(/^chunks\/sandpiper_resources-.*\.js$/),
        expect.stringMatching(/^chunks\/sandpiper_standalone-.*\.js$/),
        expect.stringMatching(/^chunks\/deferred_pi_import-.*\.js$/),
        'sandpiper-tasks',
        'trail',
        'README.md',
        'docs/README.md',
        'dist/modes/index.js',
        'dist/core/system-prompt.js',
        'extensions/system.ts',
        'prompts/new-feature.md',
        'packages/trail/docs/README.md',
        'packages/resources/skills/sandpiper/tasks/SKILL.md',
        'packages/resources/skills/sandpiper/tasks/scripts/trail',
        'packages/resources/skills/sandpiper/tasks/scripts/sandpiper-tasks',
        'packages/resources/skills/sandpiper/standup/scripts/sandpiper-standup',
        'packages/resources/skills-on-demand/sandpiper/skill-review/references/skill-building-guide.pdf',
        'skills/sandpiper/tasks/SKILL.md',
        'skills/sandpiper/tasks/scripts/trail',
        'skills/sandpiper/tasks/scripts/sandpiper-tasks',
        'skills/sandpiper/standup/scripts/sandpiper-standup',
        'skills-on-demand/sandpiper/skill-review/references/skill-building-guide.pdf',
        'skills-on-demand/third-party/pdf/SKILL.md',
        'skills-on-demand/third-party/skill-creator/SKILL.md',
      ]),
    );
    expect(packedFiles).not.toContain('.sandpiper/docs/README.md');
    expect(packedFiles).not.toContain('neutral-pi-package/package.json');
    expect(packedFiles).not.toContain('claude-plugin/.claude-plugin/plugin.json');
  });

  it('does not leak development scratch files into generated skill packages', () => {
    const skillRoots = [join(repoRoot, 'dist', 'skills')];

    for (const skillRoot of skillRoots) {
      expect(readFileSync(join(skillRoot, 'sandpiper', 'jj', 'SKILL.md'), 'utf-8')).toContain('name: jj');
      expect(existsSync(join(skillRoot, 'sandpiper', 'jj-workspace', 'run_loop.log'))).toBe(false);
      expect(existsSync(join(skillRoot, 'sandpiper', 'jj-workspace', 'run_loop.pid'))).toBe(false);
    }
  });
});
