import { describe, expect, it, vi } from 'vitest';
import { buildSystemDiagnosticsStartupPlan } from './system-diagnostics.js';

describe('buildSystemDiagnosticsStartupPlan', () => {
  it('returns no diagnostics by default', () => {
    const plan = buildSystemDiagnosticsStartupPlan({ cwd: '/repo' }, { detectUnmigratedConfigs: vi.fn(() => []) });

    expect(plan).toEqual({ unhealthyDiagnostics: [] });
  });

  it('adds an unmigrated pi config diagnostic', () => {
    const detectUnmigratedConfigs = vi.fn(() => ['/home/user/.pi', '/repo/.pi']);

    const plan = buildSystemDiagnosticsStartupPlan({ cwd: '/repo' }, { detectUnmigratedConfigs });

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
});
