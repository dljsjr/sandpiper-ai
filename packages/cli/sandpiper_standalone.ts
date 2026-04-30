#!/usr/bin/env bun

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  configurePiEnvironment,
  defaultStandaloneMainArgs,
  hasConfiguredSandpiperPackage,
  mirrorPiSandpiperEnvironment,
  prepareStandalonePackageDir,
  resolveStandalonePaths,
} from './standalone_bootstrap.js';

process.title = 'sandpiper';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const standalonePaths = resolveStandalonePaths({ startDir: scriptDir, env: process.env });

const upstreamPiDistDir = dirname(fileURLToPath(import.meta.resolve('@mariozechner/pi-coding-agent')));
const upstreamPiPackageDir = dirname(upstreamPiDistDir);
const piPackageJson = JSON.parse(readFileSync(join(upstreamPiPackageDir, 'package.json'), 'utf-8')) as {
  version: string;
};

if (standalonePaths.packageDirSource === 'generated') {
  prepareStandalonePackageDir({
    packageDir: standalonePaths.packageDir,
    resourceRoot: standalonePaths.resourceRoot,
    piPackageDir: upstreamPiPackageDir,
  });
}

configurePiEnvironment(
  {
    packageDir: standalonePaths.packageDir,
    piPackageDir: upstreamPiPackageDir,
    piVersion: piPackageJson.version,
  },
  process.env,
);
mirrorPiSandpiperEnvironment(process.env);
console.log(`using pi-coding-agent version: ${piPackageJson.version}\n`);

const { main } = await import('@mariozechner/pi-coding-agent');
const { createSandpiperExtensionFactories } = await import('./sandpiper_resources.js');

const extensionFactories = hasConfiguredSandpiperPackage({
  resourceRoot: standalonePaths.resourceRoot,
  cwd: process.cwd(),
  env: process.env,
})
  ? []
  : createSandpiperExtensionFactories(standalonePaths.resourceRoot);

await main(defaultStandaloneMainArgs(process.argv.slice(2), process.env), {
  extensionFactories,
});
