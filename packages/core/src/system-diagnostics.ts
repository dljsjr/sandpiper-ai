import { detectUnmigratedConfigs as defaultDetectUnmigratedConfigs } from './migrate-pi-configs.js';

export interface SystemDiagnostic {
  /** Unique key identifying the diagnostic (e.g. 'system:unmigrated-pi-configs'). */
  readonly key: string;
  /** Whether the check passed. */
  readonly healthy: boolean;
  /** Short one-liner describing the check or the problem. */
  readonly message: string;
  /** Actionable steps shown in the diagnostic banner when unhealthy. */
  readonly instructions?: readonly string[];
}

export interface SystemDiagnosticsStartupInput {
  readonly cwd: string;
}

export interface SystemDiagnosticsStartupPlan {
  readonly unhealthyDiagnostics: readonly SystemDiagnostic[];
}

export interface SystemDiagnosticsDependencies {
  readonly detectUnmigratedConfigs?: (cwd: string) => readonly string[];
}

function dependenciesWithDefaults(
  dependencies: SystemDiagnosticsDependencies = {},
): Required<SystemDiagnosticsDependencies> {
  return {
    detectUnmigratedConfigs: dependencies.detectUnmigratedConfigs ?? defaultDetectUnmigratedConfigs,
  };
}

function buildUnmigratedPiConfigsDiagnostic(paths: readonly string[]): SystemDiagnostic | undefined {
  if (paths.length === 0) return undefined;

  return {
    key: 'system:unmigrated-pi-configs',
    healthy: false,
    message: `Unmigrated pi configs detected: ${paths.join(', ')}`,
    instructions: [
      'Migrate:  sandpiper --migrate-pi-configs',
      'Symlink:  sandpiper --symlink-config',
      'Or run:   /migrate-pi move',
    ],
  };
}

export function buildSystemDiagnosticsStartupPlan(
  input: SystemDiagnosticsStartupInput,
  diagnosticsDependencies: SystemDiagnosticsDependencies = {},
): SystemDiagnosticsStartupPlan {
  const dependencies = dependenciesWithDefaults(diagnosticsDependencies);
  const unmigratedDiagnostic = buildUnmigratedPiConfigsDiagnostic(dependencies.detectUnmigratedConfigs(input.cwd));

  return {
    unhealthyDiagnostics: unmigratedDiagnostic ? [unmigratedDiagnostic] : [],
  };
}
