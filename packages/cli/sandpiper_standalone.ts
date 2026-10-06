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
  type StandalonePaths,
} from './standalone_bootstrap.js';

interface PiMetadata {
  readonly packageDir: string;
  readonly version: string;
}

interface StandaloneAppPackageJson {
  readonly piCodingAgentVersion?: string;
}

function resolvePiMetadata(standalonePaths: StandalonePaths): PiMetadata {
  if (standalonePaths.packageDirSource === 'app-bundle') {
    const packageJson = JSON.parse(
      readFileSync(join(standalonePaths.packageDir, 'package.json'), 'utf-8'),
    ) as StandaloneAppPackageJson;

    if (packageJson.piCodingAgentVersion === undefined) {
      throw new Error('Standalone app package.json is missing piCodingAgentVersion');
    }

    return { packageDir: standalonePaths.packageDir, version: packageJson.piCodingAgentVersion };
  }

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
  executablePath: process.execPath,
  env: process.env,
});
const piMetadata = resolvePiMetadata(standalonePaths);

if (standalonePaths.packageDirSource === 'generated') {
  prepareStandalonePackageDir({
    packageDir: standalonePaths.packageDir,
    resourceRoot: standalonePaths.resourceRoot,
    piPackageDir: piMetadata.packageDir,
  });
}

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

if (standalonePaths.packageDirSource === 'app-bundle') {
  // Loaded only in the compiled app, so other runs do not pay for Bedrock's SDK at startup.
  await import('./compiled_runtime_setup.js');
}

const { loadPiMain } = await import('./deferred_pi_import.js');
const { createSandpiperExtensionFactories } = await import('./sandpiper_resources.js');
const main = await loadPiMain();

const extensionFactories =
  standalonePaths.packageDirSource !== 'app-bundle' &&
  hasConfiguredSandpiperPackage({
    resourceRoot: standalonePaths.resourceRoot,
    cwd: process.cwd(),
    env: process.env,
  })
    ? []
    : createSandpiperExtensionFactories(standalonePaths.resourceRoot);

await main(defaultStandaloneMainArgs(process.argv.slice(2), process.env), {
  extensionFactories,
});
