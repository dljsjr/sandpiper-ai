import { join } from 'node:path';
import type { Command } from '@commander-js/extra-typings';
import { type HostContext, resolveHostContext, resolveSessionIdentity, type SessionIdentity } from 'sandpiper-ai-core';

export interface RootOptions {
  readonly dir?: string;
}

export interface ResolveStandupCommandContextOptions {
  readonly rootDir?: string;
  readonly cwd: string;
  readonly env: Record<string, string | undefined>;
  readonly sessionId?: string;
  readonly sessionFile?: string;
}

export interface StandupCommandContext {
  readonly host: HostContext;
  readonly standupPath: string;
  readonly session: SessionIdentity;
}

export interface StandupSessionEnvNames {
  readonly sessionId: string;
  readonly sessionFile: string;
}

const SANDPIPER_STANDUP_IDENTITY = {
  appName: 'sandpiper',
  configDirName: '.sandpiper',
  agentDirName: 'agent',
} as const;

export const SANDPIPER_SESSION_ENV_NAMES: StandupSessionEnvNames = {
  sessionId: 'SANDPIPER_SESSION_ID',
  sessionFile: 'SANDPIPER_SESSION_FILE',
} as const;

// 0.82.0 injects PI_SESSION_ID/PI_SESSION_FILE into Pi bash-tool child processes at spawn
// time (bash.ts) -- NOT covered by mirrorPiSandpiperEnvironment, which only runs once at
// boot in the parent process, so a sandpiper-standup invocation from inside a bash-tool
// child otherwise sees neither SANDPIPER_SESSION_* var set. Accept them as fallbacks;
// SANDPIPER_SESSION_* still wins whenever present (our own injection, set by the
// session-continuity extension). Shell-relay panes and user shells never receive Pi's
// bash-tool env, so this is a pure fallback with no risk of shadowing a real user-set
// SANDPIPER_SESSION_* value.
const PI_SESSION_FALLBACK_ENV_NAMES: StandupSessionEnvNames = {
  sessionId: 'PI_SESSION_ID',
  sessionFile: 'PI_SESSION_FILE',
} as const;

export function formatSessionIdHelp(envNames = SANDPIPER_SESSION_ENV_NAMES): string {
  return `Session ID — any stable string identifying this session across successive writes, not necessarily a UUID (defaults to ${envNames.sessionId}, falling back to ${PI_SESSION_FALLBACK_ENV_NAMES.sessionId})`;
}

export function formatSessionFileHelp(envNames = SANDPIPER_SESSION_ENV_NAMES): string {
  return `Session file path (defaults to ${envNames.sessionFile}, falling back to ${PI_SESSION_FALLBACK_ENV_NAMES.sessionFile})`;
}

export function formatMissingSessionIdMessage(envNames = SANDPIPER_SESSION_ENV_NAMES): string {
  return `Session ID required. Provide --id or set ${envNames.sessionId} (or ${PI_SESSION_FALLBACK_ENV_NAMES.sessionId}) environment variable.`;
}

/**
 * Resolve the global --dir option from the current command context.
 */
export function getRootDir(cmd: Command): string | undefined {
  const opts = cmd.optsWithGlobals() as RootOptions;
  return opts.dir;
}

export function resolveStandupCommandContext(options: ResolveStandupCommandContextOptions): StandupCommandContext {
  const host = resolveHostContext({
    cwd: options.rootDir ?? options.cwd,
    identity: SANDPIPER_STANDUP_IDENTITY,
  });

  const env = {
    ...options.env,
    SANDPIPER_SESSION_ID: options.env.SANDPIPER_SESSION_ID ?? options.env.PI_SESSION_ID,
    SANDPIPER_SESSION_FILE: options.env.SANDPIPER_SESSION_FILE ?? options.env.PI_SESSION_FILE,
  };

  return {
    host,
    standupPath: join(host.paths.projectConfigDir, 'standup.md'),
    session: resolveSessionIdentity({
      sessionId: options.sessionId,
      sessionFile: options.sessionFile,
      env,
      envNames: SANDPIPER_SESSION_ENV_NAMES,
    }),
  };
}
