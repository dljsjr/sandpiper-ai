#!/usr/bin/env bun

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI, ExtensionFactory } from '@earendil-works/pi-coding-agent';
import { findPackageRoot } from './standalone_bootstrap.js';

process.title = 'sandpiper-spike';

function resolvePackageDir(repoRoot: string): string {
  const override = process.env.SANDPIPER_SPIKE_PACKAGE_DIR;
  if (override !== undefined && override.length > 0) {
    return resolve(override);
  }
  return repoRoot;
}

function createSpikeExtension(skillRoot: string): ExtensionFactory {
  return (pi: ExtensionAPI) => {
    pi.registerFlag('standalone-spike', {
      description: 'Marker flag registered by the standalone Sandpiper spike entrypoint',
      type: 'boolean',
      default: false,
    });

    pi.on('resources_discover', () => ({
      skillPaths: [skillRoot],
    }));
  };
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.SANDPIPER_SPIKE_REPO_ROOT
  ? resolve(process.env.SANDPIPER_SPIKE_REPO_ROOT)
  : findPackageRoot(scriptDir, 'sandpiper-ai');
const packageDir = resolvePackageDir(repoRoot);
const spikeSkillRoot = join(repoRoot, 'packages', 'cli', 'fixtures', 'standalone-spike-skills');

process.env.PI_PACKAGE_DIR = packageDir;
process.env.PI_SKIP_VERSION_CHECK = '1';

const { main } = await import('@earendil-works/pi-coding-agent');

await main(process.argv.slice(2), {
  extensionFactories: [createSpikeExtension(spikeSkillRoot)],
});
