#!/usr/bin/env bun

import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface PackageMetadata {
  readonly name: string;
  readonly version: string;
  readonly files: readonly string[];
}

export async function packCli(repoRoot: string, tarball: string, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const packageDir = join(repoRoot, 'packages', 'cli');
  const metadata = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8')) as PackageMetadata;
  const stage = await mkdtemp(join(tmpdir(), 'sandpiper-cli-pack-'));
  try {
    for (const path of ['package.json', 'README.md', ...metadata.files]) {
      await cp(join(packageDir, path), join(stage, path), { recursive: true, dereference: true });
    }
    await cp(join(repoRoot, 'LICENSE'), join(stage, 'LICENSE'));
    // Pack tools do not find hoisted workspace dependencies without a local node_modules root.
    await symlink(
      join(repoRoot, 'node_modules'),
      join(stage, 'node_modules'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    await mkdir(dirname(resolve(tarball)), { recursive: true });
    execFileSync(
      env.BUN_EXECUTABLE ?? 'bun',
      ['pm', 'pack', '--ignore-scripts', '--quiet', '--filename', resolve(tarball)],
      {
        cwd: stage,
        env,
        timeout: 60_000,
      },
    );
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const metadata = JSON.parse(
    await readFile(join(repoRoot, 'packages', 'cli', 'package.json'), 'utf8'),
  ) as PackageMetadata;
  const tarball = join(repoRoot, 'packages', 'cli', 'dist', `${metadata.name}-${metadata.version}.tgz`);
  await packCli(repoRoot, tarball);
  console.log(tarball);
}
