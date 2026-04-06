import { existsSync, readFileSync } from 'node:fs';
import { getPidFilePath } from 'sandpiper-ai-core';

export interface PidFile {
  readonly pid: number;
  readonly createdAt: string;
  readonly cwd: string;
  readonly isAlive: boolean;
}

/**
 * Check if a session's process is still alive.
 * Returns null if the PID file doesn't exist, otherwise returns the PID file info.
 */
export function checkProcessLiveness(sessionId: string): PidFile | null {
  const pidFilePath = getPidFilePath(sessionId);

  if (!existsSync(pidFilePath)) {
    return null;
  }

  try {
    const content = readFileSync(pidFilePath, 'utf-8');
    const lines = content.split('\n');

    if (lines.length < 3) {
      return null;
    }

    const pid = parseInt(lines[0] || '', 10);
    const createdAt = lines[1] || '';
    const cwd = lines[2] || '';

    if (Number.isNaN(pid)) {
      return null;
    }

    // Check if process is alive using process.kill(pid, 0)
    // This doesn't actually kill the process, just checks if it exists
    let isAlive = false;
    try {
      process.kill(pid, 0);
      isAlive = true;
    } catch (error) {
      // ESRCH = no such process, EPERM = process exists but different user
      // In both cases, for our purposes: EPERM means alive, ESRCH means dead
      if ((error as NodeJS.ErrnoException).code === 'EPERM') {
        isAlive = true;
      }
    }

    return {
      pid,
      createdAt: createdAt || '',
      cwd: cwd || '',
      isAlive,
    };
  } catch {
    return null;
  }
}
