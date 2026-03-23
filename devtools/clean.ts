#!/usr/bin/env node
/**
 * Clean build artifacts, caches, and node_modules from the workspace.
 * Portable replacement for the bash glob-based clean script.
 */
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const TARGETS = ['node_modules', 'dist', '.cache', '.tsbuildinfo'];
const ROOT = join(import.meta.dirname ?? '.', '..');

/** Recursively find and delete matching directories/files. */
function clean(dir: string, depth = 0): void {
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

    // Recurse into subdirectories (but not too deep)
    if (depth < 4) {
      try {
        if (statSync(fullPath).isDirectory()) {
          clean(fullPath, depth + 1);
        }
      } catch {
        // Symlink or permission issue — skip
      }
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
