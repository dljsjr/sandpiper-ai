import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { SessionIdentityEnvNames } from './host-context.js';
import { getPidFilePath } from './paths.js';
import { type SessionEntryLike, shouldTreatInitialLoadAsColdStart } from './system-startup.js';

export interface SystemRuntimeState {
  startupContextPending: boolean;
  coldStartGuidancePending: boolean;
  currentSessionId?: string;
}

export function createSystemRuntimeState(): SystemRuntimeState {
  return {
    startupContextPending: true,
    coldStartGuidancePending: false,
  };
}

export const SANDPIPER_SESSION_ENV_NAMES: SessionIdentityEnvNames = {
  sessionId: 'SANDPIPER_SESSION_ID',
  sessionFile: 'SANDPIPER_SESSION_FILE',
};

export interface SessionContinuityStartInput {
  readonly reason: string;
  readonly cwd: string;
  readonly sessionId: string;
  readonly sessionFile?: string | null;
  readonly entries: readonly SessionEntryLike[];
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
  readonly startupContextPending: boolean;
  readonly coldStartGuidancePending: boolean;
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

function shouldStartWithColdStartGuidance(input: SessionContinuityStartInput): boolean {
  switch (input.reason) {
    case 'startup':
      return shouldTreatInitialLoadAsColdStart(input.sessionFile ?? undefined, input.entries);
    case 'new':
      return true;
    default:
      return false;
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

  state.startupContextPending = true;
  state.coldStartGuidancePending = shouldStartWithColdStartGuidance(input);

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
    startupContextPending: state.startupContextPending,
    coldStartGuidancePending: state.coldStartGuidancePending,
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
