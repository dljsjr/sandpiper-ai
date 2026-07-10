import { existsSync, readFileSync } from 'node:fs';
import { getPidFilePath } from 'sandpiper-ai-core';

export interface PidFile {
  readonly pid: number;
  readonly createdAt: string;
  readonly cwd: string;
  readonly isAlive: boolean;
}

function checkPidAlive(pid: number): boolean {
  // This doesn't actually kill the process, just checks if it exists.
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // ESRCH = no such process, EPERM = process exists but different user.
    // In both cases, for our purposes: EPERM means alive, ESRCH means dead.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * Check if a session's process is still alive.
 *
 * If `explicitPid` is provided (a section's own recorded `pid` field), it is
 * checked directly via the OS and the sandpiper pidfile registry is never
 * consulted — this is the harness-agnostic path: any caller can supply its
 * own liveness anchor without participating in sandpiper's own pidfile
 * directory convention. Falls back to the sandpiper pidfile lookup by
 * session ID when no explicit PID was recorded (sandpiper's own sessions).
 *
 * Returns null if there is no way to determine liveness at all (no explicit
 * PID and no matching pidfile).
 */
export function checkProcessLiveness(sessionId: string, explicitPid?: number): PidFile | null {
  if (explicitPid !== undefined) {
    return { pid: explicitPid, createdAt: '', cwd: '', isAlive: checkPidAlive(explicitPid) };
  }

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

    return {
      pid,
      createdAt: createdAt || '',
      cwd: cwd || '',
      isAlive: checkPidAlive(pid),
    };
  } catch {
    return null;
  }
}
