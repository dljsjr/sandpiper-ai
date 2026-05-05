import { describe, expect, it, vi } from 'vitest';
import type { PreflightDiagnostic } from './preflight.js';
import { buildSystemDiagnosticsStartupPlan } from './system-diagnostics.js';

function createPreflightSource() {
  return {
    events: {
      emit: vi.fn(),
      on: vi.fn(),
    },
  };
}

describe('buildSystemDiagnosticsStartupPlan', () => {
  it('returns unhealthy preflight diagnostics and enables update checks by default', () => {
    const healthyDiagnostic: PreflightDiagnostic = {
      key: 'healthy',
      healthy: true,
      message: 'healthy',
    };
    const unhealthyDiagnostic: PreflightDiagnostic = {
      key: 'unhealthy',
      healthy: false,
      message: 'unhealthy',
      instructions: ['fix it'],
    };

    const plan = buildSystemDiagnosticsStartupPlan(
      { cwd: '/repo', preflightSource: createPreflightSource() },
      {
        collectPreflightDiagnostics: vi.fn(() => [healthyDiagnostic, unhealthyDiagnostic]),
        detectUnmigratedConfigs: vi.fn(() => []),
        resolveEnvVar: vi.fn(() => undefined),
      },
    );

    expect(plan).toEqual({
      unhealthyDiagnostics: [unhealthyDiagnostic],
      shouldCheckForUpdates: true,
    });
  });

  it('adds an unmigrated pi config diagnostic', () => {
    const detectUnmigratedConfigs = vi.fn(() => ['/home/user/.pi', '/repo/.pi']);

    const plan = buildSystemDiagnosticsStartupPlan(
      { cwd: '/repo', preflightSource: createPreflightSource() },
      {
        collectPreflightDiagnostics: vi.fn(() => []),
        detectUnmigratedConfigs,
        resolveEnvVar: vi.fn(() => undefined),
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
      { cwd: '/repo', preflightSource: createPreflightSource() },
      {
        collectPreflightDiagnostics: vi.fn(() => []),
        detectUnmigratedConfigs: vi.fn(() => []),
        resolveEnvVar: vi.fn(() => '1'),
      },
    );

    expect(plan.shouldCheckForUpdates).toBe(false);
  });
});
