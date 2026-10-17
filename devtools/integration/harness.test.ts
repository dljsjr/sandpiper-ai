import { existsSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MOCK_MODEL_ID, MOCK_PROVIDER_ID, prepareIsolatedSpawn } from './harness.js';

describe('prepareIsolatedSpawn', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not pass the parent session's Pi and Sandpiper variables to the child", () => {
    vi.stubEnv('PI_PACKAGE_DIR', '/parent/standalone-package');
    vi.stubEnv('PI_SESSION_FILE', '/parent/session.jsonl');
    vi.stubEnv('SANDPIPER_SESSION_ID', 'parent-session');
    for (const entry of ['sandpiper', 'pi'] as const) {
      const spawn = prepareIsolatedSpawn({ entry, env: { PI_EXAMPLE: 'kept' } });
      try {
        expect(spawn.env.PI_PACKAGE_DIR).toBeUndefined();
        expect(spawn.env.PI_SESSION_FILE).toBeUndefined();
        expect(spawn.env.SANDPIPER_SESSION_ID).toBeUndefined();
        expect(spawn.env.PI_EXAMPLE).toBe('kept');
        expect(spawn.env.PI_CODING_AGENT_DIR).toBe(spawn.agentDir);
        expect(spawn.env.PATH).toBe(process.env.PATH);
      } finally {
        spawn.cleanup();
      }
    }
  });

  it('sets both agent-dir env var names to the same fresh temp dir, regardless of entry mode', () => {
    for (const entry of ['sandpiper', 'pi'] as const) {
      const spawn = prepareIsolatedSpawn({ entry });
      try {
        expect(spawn.env.SANDPIPER_CODING_AGENT_DIR).toBe(spawn.agentDir);
        expect(spawn.env.PI_CODING_AGENT_DIR).toBe(spawn.agentDir);
        expect(existsSync(spawn.agentDir)).toBe(true);
      } finally {
        spawn.cleanup();
      }
    }
  });

  it('neutralizes VCS config and points JJ_CONFIG at the Trail fixture', () => {
    const spawn = prepareIsolatedSpawn({ entry: 'pi' });
    try {
      expect(spawn.env.GIT_CONFIG_GLOBAL).toBe('/dev/null');
      expect(spawn.env.GIT_CONFIG_SYSTEM).toBe('/dev/null');
      expect(spawn.env.JJ_CONFIG).toContain('packages/trail/test-fixtures/jj-test-config.toml');
      expect(existsSync(spawn.env.JJ_CONFIG as string)).toBe(true);
    } finally {
      spawn.cleanup();
    }
  });

  it('passes --offline unconditionally, so isolated runs never make incidental startup network calls', () => {
    const spawn = prepareIsolatedSpawn({ entry: 'pi' });
    try {
      expect(spawn.args).toContain('--offline');
    } finally {
      spawn.cleanup();
    }
  });

  it('pins --provider/--model to the mock by default', () => {
    const spawn = prepareIsolatedSpawn({ entry: 'pi' });
    try {
      const providerIndex = spawn.args.indexOf('--provider');
      const modelIndex = spawn.args.indexOf('--model');
      expect(providerIndex).toBeGreaterThan(-1);
      expect(modelIndex).toBeGreaterThan(-1);
      expect(spawn.args[providerIndex + 1]).toBe(MOCK_PROVIDER_ID);
      expect(spawn.args[modelIndex + 1]).toBe(MOCK_MODEL_ID);
    } finally {
      spawn.cleanup();
    }
  });

  it('allows overriding provider/model explicitly', () => {
    const spawn = prepareIsolatedSpawn({ entry: 'pi', provider: 'anthropic', model: 'claude-not-a-real-model' });
    try {
      const providerIndex = spawn.args.indexOf('--provider');
      expect(spawn.args[providerIndex + 1]).toBe('anthropic');
    } finally {
      spawn.cleanup();
    }
  });

  it('omits --provider/--model entirely when skipProviderPin is set, reproducing the incident invocation shape', () => {
    const spawn = prepareIsolatedSpawn({ entry: 'pi', skipProviderPin: true });
    try {
      expect(spawn.args).not.toContain('--provider');
      expect(spawn.args).not.toContain('--model');
    } finally {
      spawn.cleanup();
    }
  });

  it('always loads the mock-provider extension, even with no extraExtensions', () => {
    const spawn = prepareIsolatedSpawn({ entry: 'pi' });
    try {
      const extensionPaths = spawn.args.filter((_, index) => spawn.args[index - 1] === '-e');
      expect(extensionPaths.some((path) => path.endsWith('mock-provider.ts'))).toBe(true);
    } finally {
      spawn.cleanup();
    }
  });

  it('loads extraExtensions alongside the harness extensions for entry:pi isolation', () => {
    const spawn = prepareIsolatedSpawn({ entry: 'pi', extraExtensions: ['/some/extension.ts'] });
    try {
      const extensionPaths = spawn.args.filter((_, index) => spawn.args[index - 1] === '-e');
      expect(extensionPaths).toContain('/some/extension.ts');
      expect(spawn.args).toContain('--no-extensions');
      expect(spawn.args).toContain('--no-skills');
    } finally {
      spawn.cleanup();
    }
  });

  it("does not pass --no-extensions for entry:sandpiper (loads Sandpiper's own manifest by design)", () => {
    const spawn = prepareIsolatedSpawn({ entry: 'sandpiper' });
    try {
      expect(spawn.args).not.toContain('--no-extensions');
      expect(spawn.command).toBe('bun');
      expect(spawn.args[0]).toContain('sandpiper_standalone.ts');
    } finally {
      spawn.cleanup();
    }
  });

  it('resolves entry:pi to the installed pi-coding-agent CLI entry, bypassing Sandpiper entirely', () => {
    const spawn = prepareIsolatedSpawn({ entry: 'pi' });
    try {
      expect(spawn.args[0]).toContain('pi-coding-agent');
      expect(spawn.args[0]).toContain('dist/cli.js');
      expect(spawn.args[0]).not.toContain('sandpiper_standalone');
    } finally {
      spawn.cleanup();
    }
  });

  it('inherits the caller PATH so an op-shim tripwire prefix survives into the spawned env', () => {
    const spawn = prepareIsolatedSpawn({ entry: 'pi' });
    try {
      expect(spawn.env.PATH).toBe(process.env.PATH);
    } finally {
      spawn.cleanup();
    }
  });

  it('cleanup removes the temp agent dir', () => {
    const spawn = prepareIsolatedSpawn({ entry: 'pi' });
    expect(existsSync(spawn.agentDir)).toBe(true);
    spawn.cleanup();
    expect(existsSync(spawn.agentDir)).toBe(false);
  });

  it('creates a fresh temp cwd by default and removes it on cleanup, but respects an explicit cwd without removing it', () => {
    const spawnDefault = prepareIsolatedSpawn({ entry: 'pi' });
    expect(existsSync(spawnDefault.cwd)).toBe(true);
    spawnDefault.cleanup();
    expect(existsSync(spawnDefault.cwd)).toBe(false);

    const explicitCwd = process.cwd();
    const spawnExplicit = prepareIsolatedSpawn({ entry: 'pi', cwd: explicitCwd });
    expect(spawnExplicit.cwd).toBe(explicitCwd);
    spawnExplicit.cleanup();
    expect(existsSync(explicitCwd)).toBe(true);
  });
});
