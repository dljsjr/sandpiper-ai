#!/usr/bin/env bun

import { cp, rm } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncSkillHelpers } from './syncSkillHelpers.js';

export async function stageCliResources(repoRoot: string): Promise<void> {
  await syncSkillHelpers(repoRoot);
  const packageDir = join(repoRoot, 'packages', 'cli');
  const resourceRoot = join(packageDir, 'dist', 'standalone', 'resources');
  await rm(resourceRoot, { recursive: true, force: true });
  for (const directory of ['skills', 'prompts', 'themes']) {
    await cp(join(repoRoot, 'packages', 'resources', directory), join(resourceRoot, directory), {
      recursive: true,
      dereference: true,
      filter: (path) => !basename(path).startsWith('.'),
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
