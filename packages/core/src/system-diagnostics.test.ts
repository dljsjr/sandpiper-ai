import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSystemDiagnosticsStartupPlan } from './system-diagnostics.js';

describe('buildSystemDiagnosticsStartupPlan', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns no diagnostics and enables update checks by default', () => {
    const plan = buildSystemDiagnosticsStartupPlan(
      { cwd: '/repo' },
      {
        detectUnmigratedConfigs: vi.fn(() => []),
        env: {},
      },
    );

    expect(plan).toEqual({
      unhealthyDiagnostics: [],
      shouldCheckForUpdates: true,
    });
  });

  it('adds an unmigrated pi config diagnostic', () => {
    const detectUnmigratedConfigs = vi.fn(() => ['/home/user/.pi', '/repo/.pi']);

    const plan = buildSystemDiagnosticsStartupPlan(
      { cwd: '/repo' },
      {
        detectUnmigratedConfigs,
        env: {},
      },
    );

    expect(detectUnmigratedConfigs).toHaveBeenCalledWith('/repo');
    expect(plan.unhealthyDiagnostics).toEqual([
      {
        key: 'system:unmigrated-pi-configs',
        healthy: false,
        message: 'Unmigrated pi configs detected: /home/user/.pi, /repo/.pi',
        instructions: [
          'Migrate:  sandpiper --migrate-pi-configs',
          'Symlink:  sandpiper --symlink-config',
          'Or run:   /migrate-pi move',
        ],
      },
    ]);
  });

  it('disables update checks in offline mode', () => {
    const plan = buildSystemDiagnosticsStartupPlan(
      { cwd: '/repo' },
      {
        detectUnmigratedConfigs: vi.fn(() => []),
        env: { PI_OFFLINE: '1' },
      },
    );

    expect(plan.shouldCheckForUpdates).toBe(false);
  });

  describe('update check with the process environment', () => {
    function shouldCheckForUpdates(): boolean {
      return buildSystemDiagnosticsStartupPlan(
        { cwd: '/repo' },
        {
          detectUnmigratedConfigs: vi.fn(() => []),
        },
      ).shouldCheckForUpdates;
    }

    it('skips the update check when Pi forces offline over a mirrored SANDPIPER_OFFLINE=true', () => {
      vi.stubEnv('SANDPIPER_OFFLINE', 'true');
      vi.stubEnv('PI_OFFLINE', '1');

      expect(shouldCheckForUpdates()).toBe(false);
    });

    it('skips the update check when only PI_OFFLINE=1 is set, as after --offline', () => {
      vi.stubEnv('SANDPIPER_OFFLINE', undefined);
      vi.stubEnv('PI_OFFLINE', '1');

      expect(shouldCheckForUpdates()).toBe(false);
    });

    it('runs the update check when neither offline variable is set', () => {
      vi.stubEnv('SANDPIPER_OFFLINE', undefined);
      vi.stubEnv('PI_OFFLINE', undefined);

      expect(shouldCheckForUpdates()).toBe(true);
    });
  });
});
