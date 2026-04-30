import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveHostContext, resolveSessionIdentity } from './host-context.js';

describe('host context', () => {
  it('resolves host config paths from explicit identity and directories', () => {
    const context = resolveHostContext({
      cwd: '/tmp/project',
      homeDir: '/tmp/home',
      identity: {
        appName: 'example-agent',
        configDirName: '.example-agent',
        agentDirName: 'agent-state',
      },
    });

    expect(context.cwd).toBe('/tmp/project');
    expect(context.identity.appName).toBe('example-agent');
    expect(context.paths.globalConfigDir).toBe(join('/tmp/home', '.example-agent'));
    expect(context.paths.agentDir).toBe(join('/tmp/home', '.example-agent', 'agent-state'));
    expect(context.paths.projectConfigDir).toBe(join('/tmp/project', '.example-agent'));
  });

  it('uses explicit agent directory overrides without changing project config paths', () => {
    const context = resolveHostContext({
      cwd: '/tmp/project',
      homeDir: '/tmp/home',
      agentDir: '/tmp/custom-agent',
      identity: {
        appName: 'example-agent',
        configDirName: '.example-agent',
        agentDirName: 'agent-state',
      },
    });

    expect(context.paths.agentDir).toBe('/tmp/custom-agent');
    expect(context.paths.globalConfigDir).toBe(join('/tmp/home', '.example-agent'));
    expect(context.paths.projectConfigDir).toBe(join('/tmp/project', '.example-agent'));
  });

  it('resolves session identity with explicit values taking precedence over env', () => {
    const identity = resolveSessionIdentity({
      sessionId: 'flag-session',
      sessionFile: '/tmp/flag-session.jsonl',
      env: {
        SANDPIPER_SESSION_ID: 'env-session',
        SANDPIPER_SESSION_FILE: '/tmp/env-session.jsonl',
      },
      envNames: {
        sessionId: 'SANDPIPER_SESSION_ID',
        sessionFile: 'SANDPIPER_SESSION_FILE',
      },
    });

    expect(identity.sessionId).toBe('flag-session');
    expect(identity.sessionFile).toBe('/tmp/flag-session.jsonl');
  });

  it('resolves session identity from env when explicit values are absent', () => {
    const identity = resolveSessionIdentity({
      env: {
        SANDPIPER_SESSION_ID: 'env-session',
        SANDPIPER_SESSION_FILE: '/tmp/env-session.jsonl',
      },
      envNames: {
        sessionId: 'SANDPIPER_SESSION_ID',
        sessionFile: 'SANDPIPER_SESSION_FILE',
      },
    });

    expect(identity.sessionId).toBe('env-session');
    expect(identity.sessionFile).toBe('/tmp/env-session.jsonl');
  });
});
