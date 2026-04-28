#!/usr/bin/env bun

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configurePiEnvironment, resolveStandalonePaths } from './standalone_bootstrap.js';

process.title = 'sandpiper';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const standalonePaths = resolveStandalonePaths({ startDir: scriptDir, env: process.env });

const upstreamPiDistDir = dirname(fileURLToPath(import.meta.resolve('@mariozechner/pi-coding-agent')));
const upstreamPiPackageDir = dirname(upstreamPiDistDir);
const piPackageJson = JSON.parse(readFileSync(join(upstreamPiPackageDir, 'package.json'), 'utf-8')) as {
  version: string;
};

configurePiEnvironment(
  {
    packageDir: standalonePaths.packageDir,
    piPackageDir: upstreamPiPackageDir,
    piVersion: piPackageJson.version,
  },
  process.env,
);

const { main } = await import('@mariozechner/pi-coding-agent');
const { createSandpiperExtensionFactories } = await import('./sandpiper_resources.js');

await main(process.argv.slice(2), {
  extensionFactories: createSandpiperExtensionFactories(standalonePaths.resourceRoot),
});
