import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { TaskVersionControlConfig } from '../packages/trail/src/core/storage-config.js';

export interface LegacyAdoptionFixture {
  readonly name: string;
  readonly files: Readonly<Record<string, string>>;
  readonly expected: TaskVersionControlConfig;
}

const defaults: TaskVersionControlConfig = {
  enabled: true,
  mode: { branch: '@' },
  auto_commit: false,
  auto_push: false,
};
const standalone = (value: unknown): Readonly<Record<string, string>> => ({
  '.sandpiper-tasks.json': JSON.stringify(value),
});

export const legacyAdoptionFixtures: readonly LegacyAdoptionFixture[] = [
  { name: 'no configuration', files: {}, expected: defaults },
  {
    name: 'settings without tasks',
    files: { '.sandpiper/settings.json': JSON.stringify({ theme: 'dark' }) },
    expected: defaults,
  },
  {
    name: 'standalone source wins over settings',
    files: {
      ...standalone({ version_control: { mode: { branch: 'tasks' } } }),
      '.sandpiper/settings.json': JSON.stringify({ tasks: { version_control: { enabled: false } } }),
    },
    expected: { ...defaults, mode: { branch: 'tasks' } },
  },
  {
    name: 'partial named branch',
    files: standalone({ version_control: { mode: { branch: 'tasks' } } }),
    expected: { ...defaults, mode: { branch: 'tasks' } },
  },
  ...[
    { name: 'reinforced-guidance', branch: 'sandpiper-tasks' },
    { name: 'waymark', branch: 'tasks' },
  ].map(({ name, branch }) => ({
    name: `${name} automatic commits`,
    files: standalone({ version_control: { mode: { branch }, auto_commit: true } }),
    expected: { ...defaults, mode: { branch }, auto_commit: true },
  })),
  {
    name: 'automatic push',
    files: standalone({ version_control: { mode: { branch: 'tasks' }, auto_commit: true, auto_push: true } }),
    expected: { ...defaults, mode: { branch: 'tasks' }, auto_commit: true, auto_push: true },
  },
  {
    name: 'external repository on default branch',
    files: standalone({ version_control: { mode: { repo: '/repositories/tasks.git' } } }),
    expected: { ...defaults, mode: { branch: '@', repo: '/repositories/tasks.git' } },
  },
  {
    name: 'herdr disabled settings',
    files: { '.sandpiper/settings.json': JSON.stringify({ tasks: { version_control: { enabled: false } } }) },
    expected: { ...defaults, enabled: false },
  },
  {
    name: 'wrong-typed leaf values silently default',
    files: standalone({ version_control: { enabled: 'false', auto_commit: 'true', mode: { branch: false } } }),
    expected: defaults,
  },
  { name: 'malformed JSON silently defaults', files: { '.sandpiper-tasks.json': '{' }, expected: defaults },
  {
    name: 'empty repository string is retained',
    files: standalone({ version_control: { mode: { repo: '' } } }),
    expected: { ...defaults, mode: { branch: '@', repo: '' } },
  },
];

export function writeFixtureFiles(rootDir: string, files: Readonly<Record<string, string>>): void {
  for (const [relativePath, content] of Object.entries(files)) {
    const path = join(rootDir, relativePath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
}

export function writeBoardFixture(rootDir: string): string {
  const tasksDir = join(rootDir, '.sandpiper', 'tasks');
  writeFixtureFiles(tasksDir, {
    'APP/PROJECT.md': '---\nkey: APP\nname: Application\n---\n\n# Application\n',
    'APP/APP-1.md': '---\ntitle: Parent\nstatus: NOT STARTED\nkind: TASK\n---\n\n# Parent\n\nKeep  spacing.\n',
    'APP/APP-1/APP-2.md': '---\ntitle: Child\nkind: SUBTASK\n---\n\n# Child\n',
    'APP/archive/APP-3.md': '---\ntitle: Archived\nstatus: COMPLETE\nresolution: DONE\n---\n\n# Archived\n',
    'APP/APP-4.moved': 'APP-5\n',
    'history/APP-1/2026-01-01T00-00-00.000Z.diff': '--- before\n+++ after\n@@ -1 +1 @@\n-before\n+after\n',
    'index.toon': 'Retain even an index that needs separate repair.\n',
    '.gitignore': 'index.toon\n',
  });
  return tasksDir;
}

export function fileManifest(rootDir: string): Readonly<Record<string, string>> {
  const result: Record<string, string> = {};
  function visit(relativePath: string): void {
    const path = join(rootDir, relativePath);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) result[relativePath] = `link:${readlinkSync(path)}`;
    else if (stat.isDirectory()) {
      result[relativePath] = 'directory';
      for (const name of readdirSync(path).sort()) visit(join(relativePath, name));
    } else result[relativePath] = createHash('sha256').update(readFileSync(path)).digest('hex');
  }
  visit('');
  return result;
}
