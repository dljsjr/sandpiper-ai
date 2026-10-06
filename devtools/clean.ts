#!/usr/bin/env node
/**
 * Clean build artifacts, caches, and node_modules from the workspace.
 * Portable replacement for the bash glob-based clean script.
 */
import { existsSync, lstatSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const TARGETS = ['node_modules', 'dist', '.cache', '.turbo', '.tsbuildinfo'];
const ROOT = join(import.meta.dirname ?? '.', '..');

/** Recursively find and delete matching directories/files. */
function clean(dir: string): void {
  if (!existsSync(dir)) return;

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);

    // Check if this entry matches a target
    if (TARGETS.includes(entry) || entry.endsWith('.tsbuildinfo')) {
      console.log(`rm ${fullPath}`);
      rmSync(fullPath, { recursive: true, force: true });
      continue;
    }

    // Don't recurse into node_modules (already handled above) or hidden dirs
    if (entry.startsWith('.') || entry === 'node_modules') continue;

    // lstat, so symlinked directories are never followed out of the workspace
    try {
      if (lstatSync(fullPath).isDirectory()) {
        clean(fullPath);
      }
    } catch {
      // Permission issue — skip
    }
  }
}

clean(ROOT);

// Also clean bun.lock if requested
if (process.argv.includes('--lock')) {
  const lockfile = join(ROOT, 'bun.lock');
  if (existsSync(lockfile)) {
    console.log(`rm ${lockfile}`);
    rmSync(lockfile);
  }
}

console.log('Clean complete.');
