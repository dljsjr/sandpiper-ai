#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI, ExtensionFactory } from '@mariozechner/pi-coding-agent';

process.title = 'sandpiper-spike';

function findRepoRoot(startDir: string): string {
  let dir = startDir;
  const root = resolve('/');

  while (dir !== root) {
    const packageJsonPath = join(dir, 'package.json');
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { name?: string };
      if (packageJson.name === 'sandpiper-ai') {
        return dir;
      }
    }
    dir = dirname(dir);
  }

  throw new Error(`Unable to find sandpiper-ai repo root from ${startDir}`);
}

function resolvePackageDir(repoRoot: string): string {
  const override = process.env.SANDPIPER_SPIKE_PACKAGE_DIR;
  if (override !== undefined && override.length > 0) {
    return resolve(override);
  }
  return repoRoot;
}

const spikeExtension: ExtensionFactory = (pi: ExtensionAPI) => {
  pi.registerFlag('standalone-spike', {
    description: 'Marker flag registered by the standalone Sandpiper spike entrypoint',
    type: 'boolean',
    default: false,
  });
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = findRepoRoot(scriptDir);
const packageDir = resolvePackageDir(repoRoot);

process.env.PI_PACKAGE_DIR = packageDir;
process.env.PI_SKIP_VERSION_CHECK = '1';

const { main } = await import('@mariozechner/pi-coding-agent');

await main(process.argv.slice(2), {
  extensionFactories: [spikeExtension],
});
