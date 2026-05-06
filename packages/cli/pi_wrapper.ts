#!/usr/bin/env node

process.title = 'sandpiper';

import { readFileSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '@mariozechner/pi-coding-agent';
import { findPiPackageDir } from './pi_package_dir.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const upstreamPiDistDir: string = await realpath(
  dirname(fileURLToPath(import.meta.resolve('@mariozechner/pi-coding-agent'))),
);

const upstreamPiPackageDir = dirname(upstreamPiDistDir);
const piPkgJson = JSON.parse(readFileSync(join(upstreamPiPackageDir, 'package.json'), 'utf-8'));
const piVersion = piPkgJson.version;

// Find the package directory that pi should use as its root.
// - In dist: dist/sandpiper → dist/package.json (generated with pi + piConfig)
// - In dev: source entrypoints use the generated dist/package.json. The repository
//   root package.json is a workspace manifest, not a Pi package manifest.
const overridesPackageDir = findPiPackageDir(scriptDir);
//
// ── Explicit PI_* variables ──
// These are exempt from SANDPIPER_* ↔ PI_* mirroring.
//
// Sandpiper internals — capture pi package info for self-improvement
// prompting (extension authoring, doc exploration, etc.):
process.env.PI_CODING_AGENT_PACKAGE = upstreamPiPackageDir;
process.env.PI_CODING_AGENT_VERSION = piVersion;
//
// Pi behavior controls — set by sandpiper to configure the pi runtime.
// Users may also set these, but sandpiper needs to set them to meet its
// own requirements, so they must not be overwritten by mirroring:
process.env.PI_PACKAGE_DIR = overridesPackageDir;
process.env.PI_SKIP_VERSION_CHECK = '1'; // sandpiper has its own update check
console.log(`using pi-coding-agent version: ${piVersion}\n`);

const piArgs = process.argv.slice(2);

// ── Env var mirroring ──
// Mirror PI_* ↔ SANDPIPER_* so that:
//   - Users can set either SANDPIPER_* or PI_* and both namespaces stay in sync
//   - SANDPIPER_* takes precedence over PI_* when both are set
//   - Our own code always reads SANDPIPER_* (via resolveEnvVar from core)
//
// The 4 explicit vars above are exempt — they must not leak into the
// SANDPIPER_* namespace or be overwritten by mirroring.
const EXEMPT_PI_VARS = new Set([
  'PI_CODING_AGENT_PACKAGE',
  'PI_CODING_AGENT_VERSION',
  'PI_PACKAGE_DIR',
  'PI_SKIP_VERSION_CHECK',
]);

// Phase 1: PI_* → SANDPIPER_* (only if SANDPIPER_* is not already set)
for (const [key, val] of Object.entries(process.env)) {
  if (!key.startsWith('PI_') || EXEMPT_PI_VARS.has(key) || val === undefined) continue;
  const sandpiperKey = `SANDPIPER_${key.slice(3)}`; // PI_FOO → SANDPIPER_FOO
  if (process.env[sandpiperKey] === undefined) {
    process.env[sandpiperKey] = val;
  }
}

// Phase 2: SANDPIPER_* → PI_* (unconditional — SANDPIPER_* takes precedence)
for (const [key, val] of Object.entries(process.env)) {
  if (!key.startsWith('SANDPIPER_') || val === undefined) continue;
  const piKey = `PI_${key.slice(10)}`; // SANDPIPER_FOO → PI_FOO
  if (EXEMPT_PI_VARS.has(piKey)) continue;
  process.env[piKey] = val;
}

await main(piArgs);
