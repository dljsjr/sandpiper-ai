/**
 * Shared path utilities for user-facing display.
 */

import { homedir } from 'node:os';

/**
 * Replace the user's home directory prefix with ~ for display purposes.
 * Only used for user-facing output — never for filesystem operations.
 */
export function displayPath(absolutePath: string): string {
  const home = homedir();
  if (absolutePath === home) return '~';
  if (absolutePath.startsWith(`${home}/`)) return `~${absolutePath.slice(home.length)}`;
  return absolutePath;
}
