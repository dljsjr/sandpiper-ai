import {
  performMigration as defaultPerformMigration,
  type MigrationMode,
  type MigrationResult,
  type ParsedMigrationArgs,
  type ParsedMigrationArgsError,
  parseMigrationCommandArgs,
  parseMigrationScope,
  type performMigration,
} from './migrate-pi-configs.js';

export interface MigrationControlFlags {
  readonly migratePiConfigs?: boolean;
  readonly symlinkConfig?: boolean;
  readonly piConfigsGlobal?: boolean;
  readonly piConfigsLocal?: boolean;
}

export interface MigrationStartupControlInput {
  readonly cwd: string;
  readonly flags: MigrationControlFlags;
}

export type MigrationStartupControlResult =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'exit';
      readonly exitCode: 0 | 1;
      readonly stdout: readonly string[];
      readonly stderr: readonly string[];
    };

export type MigrationCommandResult =
  | { readonly kind: 'notify'; readonly message: string; readonly level: 'error' | 'info' }
  | {
      readonly kind: 'reload';
      readonly clearDiagnosticsWidget: string;
      readonly message: string;
      readonly level: 'info';
    };

export interface MigrationCommandInput {
  readonly args?: string;
  readonly cwd: string;
}

export interface MigrationControlDependencies {
  readonly parseMigrationCommandArgs?: (args: string) => ParsedMigrationArgs | ParsedMigrationArgsError;
  readonly parseMigrationScope?: typeof parseMigrationScope;
  readonly performMigration?: typeof performMigration;
}

function dependenciesWithDefaults(
  dependencies: MigrationControlDependencies = {},
): Required<MigrationControlDependencies> {
  return {
    parseMigrationCommandArgs: dependencies.parseMigrationCommandArgs ?? parseMigrationCommandArgs,
    parseMigrationScope: dependencies.parseMigrationScope ?? parseMigrationScope,
    performMigration: dependencies.performMigration ?? defaultPerformMigration,
  };
}

function successfulMigrationFlagOutput(result: MigrationResult): readonly string[] {
  if (result.migrated.length === 0) {
    return ['No configs to migrate.'];
  }

  return ['✓ Migration complete!', ...result.migrated.map((path) => `  Migrated: ${path}`)];
}

async function executeMigrationFlag(
  mode: MigrationMode,
  cwd: string,
  flags: MigrationControlFlags,
  dependencies: Required<MigrationControlDependencies>,
): Promise<MigrationStartupControlResult> {
  const scope = dependencies.parseMigrationScope(flags.piConfigsGlobal === true, flags.piConfigsLocal === true);
  const result = await dependencies.performMigration(mode, { cwd, scope });

  if (result.success) {
    return { kind: 'exit', exitCode: 0, stdout: successfulMigrationFlagOutput(result), stderr: [] };
  }

  return { kind: 'exit', exitCode: 1, stdout: [], stderr: [`✗ Migration failed: ${result.error}`] };
}

export async function executeMigrationStartupControls(
  input: MigrationStartupControlInput,
  controlDependencies: MigrationControlDependencies = {},
): Promise<MigrationStartupControlResult> {
  const dependencies = dependenciesWithDefaults(controlDependencies);

  const migrate = input.flags.migratePiConfigs === true;
  const symlink = input.flags.symlinkConfig === true;
  const hasScope = input.flags.piConfigsGlobal === true || input.flags.piConfigsLocal === true;

  if (hasScope && !migrate && !symlink) {
    return {
      kind: 'exit',
      exitCode: 1,
      stdout: [],
      stderr: ['Error: --pi-configs-global and --pi-configs-local require --migrate-pi-configs or --symlink-config.'],
    };
  }

  if (migrate && symlink) {
    return {
      kind: 'exit',
      exitCode: 1,
      stdout: [],
      stderr: ['Error: --migrate-pi-configs and --symlink-config are mutually exclusive.'],
    };
  }

  if (migrate) {
    return executeMigrationFlag('move', input.cwd, input.flags, dependencies);
  }
  if (symlink) {
    return executeMigrationFlag('symlink', input.cwd, input.flags, dependencies);
  }

  return { kind: 'none' };
}

export async function executeMigrationCommand(
  input: MigrationCommandInput,
  controlDependencies: MigrationControlDependencies = {},
): Promise<MigrationCommandResult> {
  const dependencies = dependenciesWithDefaults(controlDependencies);
  const parsed = dependencies.parseMigrationCommandArgs(input.args ?? '');

  if ('error' in parsed) {
    return { kind: 'notify', message: parsed.error, level: 'error' };
  }

  const result = await dependencies.performMigration(parsed.mode, { cwd: input.cwd, scope: parsed.scope });

  if (!result.success) {
    const verb = parsed.mode === 'move' ? 'Migration' : 'Symlink';
    return { kind: 'notify', message: `${verb} failed: ${result.error}`, level: 'error' };
  }

  if (result.migrated.length === 0) {
    return { kind: 'notify', message: 'No configs to migrate.', level: 'info' };
  }

  const verb = parsed.mode === 'move' ? 'Migration' : 'Symlink';
  return {
    kind: 'reload',
    clearDiagnosticsWidget: 'sandpiper-diagnostics',
    message: `${verb} complete. Reloading...`,
    level: 'info',
  };
}
