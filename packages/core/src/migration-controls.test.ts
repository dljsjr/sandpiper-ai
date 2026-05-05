import { describe, expect, it, vi } from 'vitest';
import type { MigrationResult } from './migrate-pi-configs.js';
import {
  executeMigrationCommand,
  executeMigrationStartupControls,
  type MigrationControlDependencies,
} from './migration-controls.js';

function createDependencies(overrides: Partial<MigrationControlDependencies> = {}): MigrationControlDependencies {
  return {
    formatInstallInstructions: vi.fn(() => 'source ~/.sandpiper/shell-integrations/relay.fish'),
    installShellIntegrations: vi.fn(() => ({ success: true, installedTo: '/tmp/install' })),
    parseMigrationCommandArgs: vi.fn((_args: string) => ({ mode: 'move' as const, scope: 'both' as const })),
    parseMigrationScope: vi.fn((_global: boolean, _local: boolean) => 'both' as const),
    performMigration: vi.fn(
      async (): Promise<MigrationResult> => ({
        success: true,
        migrated: ['~/.pi'],
        skipped: [],
        error: undefined,
      }),
    ),
    ...overrides,
  };
}

describe('executeMigrationStartupControls', () => {
  it('returns no-op when migration flags are absent', async () => {
    const dependencies = createDependencies();

    const result = await executeMigrationStartupControls({ cwd: '/repo', flags: {} }, dependencies);

    expect(result).toEqual({ kind: 'none' });
    expect(dependencies.installShellIntegrations).not.toHaveBeenCalled();
    expect(dependencies.performMigration).not.toHaveBeenCalled();
  });

  it('returns install instructions and exit code when shell integration installation succeeds', async () => {
    const dependencies = createDependencies();

    const result = await executeMigrationStartupControls(
      { cwd: '/repo', flags: { installShellIntegrations: true } },
      dependencies,
    );

    expect(dependencies.installShellIntegrations).toHaveBeenCalled();
    expect(result).toEqual({
      kind: 'exit',
      exitCode: 0,
      stdout: ['source ~/.sandpiper/shell-integrations/relay.fish'],
      stderr: [],
    });
  });

  it('rejects scope flags without migrate or symlink', async () => {
    const result = await executeMigrationStartupControls({ cwd: '/repo', flags: { piConfigsGlobal: true } });

    expect(result).toEqual({
      kind: 'exit',
      exitCode: 1,
      stdout: [],
      stderr: ['Error: --pi-configs-global and --pi-configs-local require --migrate-pi-configs or --symlink-config.'],
    });
  });

  it('rejects conflicting migrate and symlink flags', async () => {
    const result = await executeMigrationStartupControls({
      cwd: '/repo',
      flags: { migratePiConfigs: true, symlinkConfig: true },
    });

    expect(result).toEqual({
      kind: 'exit',
      exitCode: 1,
      stdout: [],
      stderr: ['Error: --migrate-pi-configs and --symlink-config are mutually exclusive.'],
    });
  });

  it('runs a successful migration flag operation', async () => {
    const dependencies = createDependencies();

    const result = await executeMigrationStartupControls(
      { cwd: '/repo', flags: { migratePiConfigs: true, piConfigsGlobal: true } },
      dependencies,
    );

    expect(dependencies.parseMigrationScope).toHaveBeenCalledWith(true, false);
    expect(dependencies.performMigration).toHaveBeenCalledWith('move', { cwd: '/repo', scope: 'both' });
    expect(result).toEqual({
      kind: 'exit',
      exitCode: 0,
      stdout: ['✓ Migration complete!', '  Migrated: ~/.pi'],
      stderr: [],
    });
  });

  it('returns a failed migration flag operation', async () => {
    const dependencies = createDependencies({
      performMigration: vi.fn(async () => ({ success: false, migrated: [], skipped: [], error: 'boom' })),
    });

    const result = await executeMigrationStartupControls(
      { cwd: '/repo', flags: { symlinkConfig: true } },
      dependencies,
    );

    expect(result).toEqual({
      kind: 'exit',
      exitCode: 1,
      stdout: [],
      stderr: ['✗ Migration failed: boom'],
    });
  });
});

describe('executeMigrationCommand', () => {
  it('returns parse errors as notifications', async () => {
    const dependencies = createDependencies({
      parseMigrationCommandArgs: vi.fn((_args: string) => ({ error: 'invalid args' })),
    });

    const result = await executeMigrationCommand({ args: '', cwd: '/repo' }, dependencies);

    expect(result).toEqual({ kind: 'notify', message: 'invalid args', level: 'error' });
  });

  it('returns reload action after successful command migration with migrated files', async () => {
    const dependencies = createDependencies({
      parseMigrationCommandArgs: vi.fn((_args: string) => ({ mode: 'move' as const, scope: 'both' as const })),
    });

    const result = await executeMigrationCommand({ args: 'move', cwd: '/repo' }, dependencies);

    expect(dependencies.performMigration).toHaveBeenCalledWith('move', { cwd: '/repo', scope: 'both' });
    expect(result).toEqual({
      kind: 'reload',
      clearDiagnosticsWidget: 'sandpiper-diagnostics',
      message: 'Migration complete. Reloading...',
      level: 'info',
    });
  });

  it('returns no-config notification after successful command migration with no migrated files', async () => {
    const dependencies = createDependencies({
      performMigration: vi.fn(async () => ({ success: true, migrated: [], skipped: [], error: undefined })),
    });

    const result = await executeMigrationCommand({ args: 'move', cwd: '/repo' }, dependencies);

    expect(result).toEqual({ kind: 'notify', message: 'No configs to migrate.', level: 'info' });
  });

  it('returns command migration failures as notifications', async () => {
    const dependencies = createDependencies({
      parseMigrationCommandArgs: vi.fn((_args: string) => ({ mode: 'symlink' as const, scope: 'both' as const })),
      performMigration: vi.fn(async () => ({ success: false, migrated: [], skipped: [], error: 'boom' })),
    });

    const result = await executeMigrationCommand({ args: 'symlink', cwd: '/repo' }, dependencies);

    expect(result).toEqual({ kind: 'notify', message: 'Symlink failed: boom', level: 'error' });
  });
});
