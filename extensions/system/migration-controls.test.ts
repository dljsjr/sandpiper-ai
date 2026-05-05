import * as core from 'sandpiper-ai-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerMigrationControls } from './migration-controls.js';
import { createMigrationControlsStub } from './test-helpers.js';

describe('registerMigrationControls', () => {
  beforeEach(() => {
    vi.spyOn(core, 'executeMigrationStartupControls').mockResolvedValue({ kind: 'none' });
    vi.spyOn(core, 'executeMigrationCommand').mockResolvedValue({
      kind: 'notify',
      message: 'No configs to migrate.',
      level: 'info',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers migration flags and handles command parse errors', async () => {
    const { pi, commands } = createMigrationControlsStub();
    registerMigrationControls(pi as Parameters<typeof registerMigrationControls>[0]);

    expect(pi.registerFlag).toHaveBeenCalledTimes(5);

    const command = commands.find((item) => item.name === 'migrate-pi');
    if (!command) {
      throw new Error('migrate-pi command not registered');
    }

    vi.spyOn(core, 'executeMigrationCommand').mockResolvedValue({
      kind: 'notify',
      message: 'invalid args',
      level: 'error',
    });
    const notify = vi.fn();
    await command.handler('', {
      cwd: '/repo',
      reload: async () => {},
      ui: { notify, setWidget: vi.fn() },
    });

    expect(notify).toHaveBeenCalledWith('invalid args', 'error');
  });

  it('runs successful command migrations and reloads the session', async () => {
    const { pi, commands } = createMigrationControlsStub();
    registerMigrationControls(pi as Parameters<typeof registerMigrationControls>[0]);

    const command = commands.find((item) => item.name === 'migrate-pi');
    if (!command) {
      throw new Error('migrate-pi command not registered');
    }

    vi.spyOn(core, 'executeMigrationCommand').mockResolvedValue({
      kind: 'reload',
      clearDiagnosticsWidget: 'sandpiper-diagnostics',
      message: 'Migration complete. Reloading...',
      level: 'info',
    });

    const notify = vi.fn();
    const setWidget = vi.fn();
    const reload = vi.fn(async () => {});

    await command.handler('move', {
      cwd: '/repo',
      reload,
      ui: { notify, setWidget },
    });

    expect(core.executeMigrationCommand).toHaveBeenCalledWith({ args: 'move', cwd: '/repo' });
    expect(setWidget).toHaveBeenCalledWith('sandpiper-diagnostics', undefined);
    expect(notify).toHaveBeenCalledWith('Migration complete. Reloading...', 'info');
    expect(reload).toHaveBeenCalled();
  });

  it('rejects conflicting migrate/symlink flags during session_start handling', async () => {
    const { pi, events } = createMigrationControlsStub({
      'install-shell-integrations': false,
      'migrate-pi-configs': true,
      'symlink-config': true,
      'pi-configs-global': false,
      'pi-configs-local': false,
    });
    registerMigrationControls(pi as Parameters<typeof registerMigrationControls>[0]);

    const handler = events.get('session_start');
    if (!handler) {
      throw new Error('session_start handler not registered');
    }

    vi.spyOn(core, 'executeMigrationStartupControls').mockResolvedValue({
      kind: 'exit',
      exitCode: 1,
      stdout: [],
      stderr: ['Error: --migrate-pi-configs and --symlink-config are mutually exclusive.'],
    });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await handler({}, { cwd: '/repo' });

    expect(core.executeMigrationStartupControls).toHaveBeenCalledWith({
      cwd: '/repo',
      flags: {
        installShellIntegrations: false,
        migratePiConfigs: true,
        symlinkConfig: true,
        piConfigsGlobal: false,
        piConfigsLocal: false,
      },
    });
    expect(errorSpy).toHaveBeenCalledWith('Error: --migrate-pi-configs and --symlink-config are mutually exclusive.');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
