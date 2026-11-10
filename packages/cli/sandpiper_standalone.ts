#!/usr/bin/env bun

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  configurePiEnvironment,
  mirrorPiSandpiperEnvironment,
  resolveStandalonePaths,
} from './standalone_bootstrap.js';

interface PiMetadata {
  readonly packageDir: string;
  readonly version: string;
}

function resolvePiMetadata(): PiMetadata {
  const upstreamPiDistDir = dirname(fileURLToPath(import.meta.resolve('@earendil-works/pi-coding-agent')));
  const upstreamPiPackageDir = dirname(upstreamPiDistDir);
  const piPackageJson = JSON.parse(readFileSync(join(upstreamPiPackageDir, 'package.json'), 'utf-8')) as {
    version: string;
  };

  return { packageDir: upstreamPiPackageDir, version: piPackageJson.version };
}

process.title = 'sandpiper';
// Pi's own cli.ts/rpc-entry.ts set AI_AGENT="pi" for child-process attribution, but this
// standalone entry calls main() directly and never goes through either -- set our own
// equivalent here so spawned children (e.g. the bash tool) can still detect they're running
// under an AI coding agent.
process.env.AI_AGENT = 'sandpiper';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const standalonePaths = resolveStandalonePaths({
  startDir: scriptDir,
  env: process.env,
});
const piMetadata = resolvePiMetadata();

configurePiEnvironment(
  {
    packageDir: standalonePaths.packageDir,
    piPackageDir: piMetadata.packageDir,
    piVersion: piMetadata.version,
  },
  process.env,
);
mirrorPiSandpiperEnvironment(process.env);
// stderr, not stdout: RPC mode expects well-formed JSON-LD over stdout and can't
// tolerate arbitrary interleaved text. Opt-in only -- useful when debugging the
// distribution machinery, noisy otherwise.
if (process.env.SANDPIPER_PRINT_PI_VERSION === '1') {
  console.error(`using pi-coding-agent version: ${piMetadata.version}\n`);
}

const { loadPiMain } = await import('./deferred_pi_import.js');
const { createSandpiperExtensionFactories } = await import('./sandpiper_resources.js');
const main = await loadPiMain();

await main(process.argv.slice(2), {
  extensionFactories: createSandpiperExtensionFactories(),
});
