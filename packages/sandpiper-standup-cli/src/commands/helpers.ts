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

export function formatSessionIdHelp(envNames = SANDPIPER_SESSION_ENV_NAMES): string {
  return `Session ID — any stable string identifying this session across successive writes, not necessarily a UUID (defaults to ${envNames.sessionId})`;
}

export function formatSessionFileHelp(envNames = SANDPIPER_SESSION_ENV_NAMES): string {
  return `Session file path (defaults to ${envNames.sessionFile})`;
}

export function formatMissingSessionIdMessage(envNames = SANDPIPER_SESSION_ENV_NAMES): string {
  return `Session ID required. Provide --id or set ${envNames.sessionId} environment variable.`;
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

  return {
    host,
    standupPath: join(host.paths.projectConfigDir, 'standup.md'),
    session: resolveSessionIdentity({
      sessionId: options.sessionId,
      sessionFile: options.sessionFile,
      env: options.env,
      envNames: SANDPIPER_SESSION_ENV_NAMES,
    }),
  };
}
