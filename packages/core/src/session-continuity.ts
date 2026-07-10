import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { SessionIdentityEnvNames } from './host-context.js';
import { getPidFilePath } from './paths.js';

export interface SystemRuntimeState {
  currentSessionId?: string;
}

export function createSystemRuntimeState(): SystemRuntimeState {
  return {};
}

export const SANDPIPER_SESSION_ENV_NAMES: SessionIdentityEnvNames = {
  sessionId: 'SANDPIPER_SESSION_ID',
  sessionFile: 'SANDPIPER_SESSION_FILE',
};

export interface SessionContinuityStartInput {
  readonly cwd: string;
  readonly sessionId: string;
  readonly sessionFile?: string | null;
}

export interface SessionContinuityOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly envNames?: SessionIdentityEnvNames;
  readonly pid?: number;
  readonly now?: () => Date;
  readonly pidFilePathForSession?: (sessionId: string) => string;
}

export interface SessionContinuityStartResult {
  readonly sessionId: string;
  readonly sessionFile?: string;
  readonly pidFilePath: string;
  readonly removedPidFilePath?: string;
}

export interface SessionContinuityShutdownResult {
  readonly sessionId?: string;
  readonly removedPidFilePath?: string;
}

function resolvePidFilePath(sessionId: string, options: SessionContinuityOptions): string {
  return options.pidFilePathForSession?.(sessionId) ?? getPidFilePath(sessionId);
}

function writePidFile(path: string, cwd: string, options: SessionContinuityOptions): void {
  mkdirSync(dirname(path), { recursive: true });
  const pid = options.pid ?? process.pid;
  const timestamp = (options.now ?? (() => new Date()))().toISOString();
  writeFileSync(path, [pid.toString(), timestamp, cwd].join('\n'), 'utf-8');
}

function removePidFile(path: string): void {
  if (existsSync(path)) {
    rmSync(path);
  }
}

export function handleSandpiperSessionStart(
  state: SystemRuntimeState,
  input: SessionContinuityStartInput,
  options: SessionContinuityOptions = {},
): SessionContinuityStartResult {
  const env = options.env ?? process.env;
  const envNames = options.envNames ?? SANDPIPER_SESSION_ENV_NAMES;
  const previousSessionId = state.currentSessionId;
  let removedPidFilePath: string | undefined;

  env[envNames.sessionId] = input.sessionId;
  if (input.sessionFile) {
    env[envNames.sessionFile] = input.sessionFile;
  }

  if (previousSessionId !== undefined && previousSessionId !== input.sessionId) {
    removedPidFilePath = resolvePidFilePath(previousSessionId, options);
    removePidFile(removedPidFilePath);
  }

  const pidFilePath = resolvePidFilePath(input.sessionId, options);
  writePidFile(pidFilePath, input.cwd, options);
  state.currentSessionId = input.sessionId;

  return {
    sessionId: input.sessionId,
    sessionFile: input.sessionFile || undefined,
    pidFilePath,
    removedPidFilePath,
  };
}

export function handleSandpiperSessionShutdown(
  state: SystemRuntimeState,
  options: SessionContinuityOptions = {},
): SessionContinuityShutdownResult {
  const sessionId = state.currentSessionId;
  if (sessionId === undefined) {
    return {};
  }

  const removedPidFilePath = resolvePidFilePath(sessionId, options);
  removePidFile(removedPidFilePath);
  state.currentSessionId = undefined;

  return { sessionId, removedPidFilePath };
}
