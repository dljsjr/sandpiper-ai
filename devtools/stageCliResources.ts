#!/usr/bin/env bun

import { existsSync } from 'node:fs';
import { cp, rm } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function stageCliResources(repoRoot: string): Promise<void> {
  const packageDir = join(repoRoot, 'packages', 'cli');
  const resourceRoot = join(packageDir, 'dist', 'standalone', 'resources');
  await rm(resourceRoot, { recursive: true, force: true });
  for (const directory of ['skills', 'prompts', 'themes']) {
    const source = join(repoRoot, 'packages', 'resources', directory);
    await cp(source, join(resourceRoot, directory), {
      recursive: true,
      dereference: true,
      filter: (path) =>
        !basename(path).startsWith('.') &&
        (directory !== 'skills' || dirname(path) !== source || existsSync(join(path, 'SKILL.md'))),
    });
  }
  const docs = join(packageDir, 'docs');
  await rm(docs, { recursive: true, force: true });
  await cp(join(repoRoot, 'docs'), docs, {
    recursive: true,
    dereference: true,
    filter: (path) => !basename(path).startsWith('.'),
  });
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await stageCliResources(dirname(dirname(fileURLToPath(import.meta.url))));
}
