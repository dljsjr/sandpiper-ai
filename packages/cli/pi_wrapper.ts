#!/usr/bin/env node

process.title = 'sandpiper';

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { readFile, realpath } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));

// Locate the system pi binary. Try (in order):
// 1. .pi-binpath file next to this script (written at install time)
// 2. .pi-binpath in dist/ subdirectory (dev mode: script is in packages/cli/)
// 3. `which pi` fallback (dev mode without prior install)
let systemPiDistDir: string;

const binpathHere = join(scriptDir, '.pi-binpath');
const binpathDist = join(scriptDir, 'dist', '.pi-binpath');

if (existsSync(binpathHere)) {
  systemPiDistDir = dirname(await realpath((await readFile(binpathHere, 'utf-8')).trim()));
} else if (existsSync(binpathDist)) {
  systemPiDistDir = dirname(await realpath((await readFile(binpathDist, 'utf-8')).trim()));
} else {
  // Fallback: find pi on PATH
  try {
    const piBin = execSync('which pi', { encoding: 'utf-8' }).trim();
    systemPiDistDir = dirname(await realpath(piBin));
  } catch {
    console.error('Error: Could not find pi binary. Install pi globally or run the build first.');
    process.exit(1);
  }
}

const systemPiPackageDir = dirname(systemPiDistDir);
const piPkgJson = JSON.parse(await readFile(join(systemPiPackageDir, 'package.json'), 'utf-8'));
const piVersion = piPkgJson.version;

// Find the package directory that pi should use as its root.
// Walk up from the script location until we find a package.json with the `pi`
// key (which declares extensions/skills/prompts/themes resource paths).
// - In dist: dist/sandpiper → dist/package.json (generated with pi + piConfig)
// - In dev via .bin symlink: packages/cli/dist/sandpiper → walks up to repo root
// - In dev direct: packages/cli/pi_wrapper.ts → walks up to repo root
function findPackageDir(startDir: string): string {
  let dir = startDir;
  const root = resolve('/');
  while (dir !== root) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (pkg.pi) {
          return dir;
        }
      } catch {
        // Not valid JSON or not readable — keep walking
      }
    }
    dir = dirname(dir);
  }
  // Fallback: two levels up (original behavior)
  return resolve(join(startDir, '..', '..'));
}

const overridesPackageDir = findPackageDir(scriptDir);

// ── Explicit PI_* variables ──
// These are pi-framework-specific and must not be mirrored to/from SANDPIPER_*.
process.env.PI_PACKAGE_DIR = overridesPackageDir;
process.env.PI_CODING_AGENT_PACKAGE = systemPiPackageDir;
process.env.PI_CODING_AGENT_VERSION = piVersion;
// Suppress pi's built-in version check — sandpiper handles its own
// update notifications via the system extension.
process.env.PI_SKIP_VERSION_CHECK = '1';
console.log(`using pi-coding-agent version: ${piVersion}\n`);

// ── Env var mirroring ──
// Mirror PI_* ↔ SANDPIPER_* so that:
//   - Users can set either SANDPIPER_* or PI_* and both namespaces stay in sync
//   - SANDPIPER_* takes precedence over PI_* when both are set
//   - Our own code always reads SANDPIPER_* (except the 4 explicit vars above)
//
// The 4 explicit vars above are exempt — they are pi-framework internals that
// we set directly and should not leak into the SANDPIPER_* namespace.
const EXEMPT_PI_VARS = new Set([
  'PI_PACKAGE_DIR',
  'PI_CODING_AGENT_PACKAGE',
  'PI_CODING_AGENT_VERSION',
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

(await import(join(systemPiDistDir, 'main.js'))).main(process.argv.slice(2));
