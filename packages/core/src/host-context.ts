import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export interface HostIdentity {
  readonly appName: string;
  readonly configDirName: string;
  readonly agentDirName: string;
}

export interface HostPaths {
  readonly globalConfigDir: string;
  readonly agentDir: string;
  readonly projectConfigDir: string;
}

export interface HostContext {
  readonly identity: HostIdentity;
  readonly cwd: string;
  readonly paths: HostPaths;
}

export interface ResolveHostContextOptions {
  readonly cwd: string;
  readonly identity: HostIdentity;
  readonly homeDir?: string;
  readonly agentDir?: string;
}

export interface SessionIdentity {
  readonly sessionId?: string;
  readonly sessionFile?: string;
}

export interface SessionIdentityEnvNames {
  readonly sessionId: string;
  readonly sessionFile: string;
}

export interface ResolveSessionIdentityOptions extends SessionIdentity {
  readonly env: Record<string, string | undefined>;
  readonly envNames: SessionIdentityEnvNames;
}

export function resolveHostContext(options: ResolveHostContextOptions): HostContext {
  const cwd = resolve(options.cwd);
  const home = resolve(options.homeDir ?? homedir());
  const globalConfigDir = join(home, options.identity.configDirName);

  return {
    identity: options.identity,
    cwd,
    paths: {
      globalConfigDir,
      agentDir: options.agentDir ? resolve(options.agentDir) : join(globalConfigDir, options.identity.agentDirName),
      projectConfigDir: join(cwd, options.identity.configDirName),
    },
  };
}

export function resolveSessionIdentity(options: ResolveSessionIdentityOptions): SessionIdentity {
  return {
    sessionId: options.sessionId || options.env[options.envNames.sessionId],
    sessionFile: options.sessionFile || options.env[options.envNames.sessionFile],
  };
}
