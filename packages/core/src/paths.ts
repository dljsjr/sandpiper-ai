/**
 * Shared path utilities for user-facing display.
 */

import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

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

/**
 * Resolve the XDG state home directory.
 * Returns $XDG_STATE_HOME if set, otherwise falls back to ~/.local/state.
 * Expands ~ to the home directory.
 */
export function getXdgStateHome(): string {
  const home = homedir();
  let stateHome = process.env.XDG_STATE_HOME;

  if (!stateHome) {
    stateHome = join(home, '.local', 'state');
  } else if (stateHome.startsWith('~/')) {
    stateHome = join(home, stateHome.slice(2));
  } else if (stateHome === '~') {
    stateHome = home;
  }

  return stateHome;
}

/**
 * Get the sandpiper sessions directory path (pure function).
 */
export function getSandpiperSessionsDirPath(): string {
  return join(getXdgStateHome(), 'sandpiper', 'sessions');
}

/**
 * Get the sandpiper sessions directory, creating it if needed.
 */
export function getSandpiperSessionsDir(): string {
  const sessionsDir = getSandpiperSessionsDirPath();
  if (!existsSync(sessionsDir)) {
    mkdirSync(sessionsDir, { recursive: true });
  }
  return sessionsDir;
}

/**
 * Get the PID file path for a session.
 */
export function getPidFilePath(sessionId: string): string {
  return join(getSandpiperSessionsDir(), `${sessionId}.pid`);
}
