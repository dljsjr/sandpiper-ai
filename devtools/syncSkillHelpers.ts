#!/usr/bin/env bun

import { chmod, copyFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface HelperCopy {
  readonly source: string;
  readonly destinations: readonly string[];
}

export async function syncSkillHelpers(repoRoot: string): Promise<void> {
  const resourceRoot = join(repoRoot, 'packages', 'resources', 'skills');
  const helpers: readonly HelperCopy[] = [
    {
      source: join(repoRoot, 'packages', 'sandpiper-standup-cli', 'dist', 'sandpiper-standup'),
      destinations: [join(resourceRoot, 'standup', 'scripts', 'sandpiper-standup')],
    },
  ];

  for (const helper of helpers) {
    for (const destination of helper.destinations) {
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(helper.source, destination);
      await chmod(destination, 0o755);
    }
  }
}

const entrypoint = process.argv[1] === undefined ? undefined : resolve(process.argv[1]);

if (entrypoint === fileURLToPath(import.meta.url)) {
  await syncSkillHelpers(dirname(dirname(fileURLToPath(import.meta.url))));
}
