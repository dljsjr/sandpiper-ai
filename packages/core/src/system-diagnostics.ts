import { detectUnmigratedConfigs as defaultDetectUnmigratedConfigs } from './migrate-pi-configs.js';
import {
  collectPreflightDiagnostics as defaultCollectPreflightDiagnostics,
  type PreflightDiagnostic,
} from './preflight.js';

// Intentionally widened to mirror Pi's event bus contract while keeping this core module Pi-free.
interface EventBusLike {
  emit(event: string, data: unknown): void;
  on(event: string, handler: (data: unknown) => void): void;
}

export interface PreflightSourceLike {
  events: EventBusLike;
}

export interface SystemDiagnosticsStartupInput {
  readonly cwd: string;
  readonly preflightSource: PreflightSourceLike;
}

export interface SystemDiagnosticsStartupPlan {
  readonly unhealthyDiagnostics: readonly PreflightDiagnostic[];
  readonly shouldCheckForUpdates: boolean;
}

export interface SystemDiagnosticsDependencies {
  readonly collectPreflightDiagnostics?: (source: PreflightSourceLike) => readonly PreflightDiagnostic[];
  readonly detectUnmigratedConfigs?: (cwd: string) => readonly string[];
  readonly env?: NodeJS.ProcessEnv;
}

function dependenciesWithDefaults(
  dependencies: SystemDiagnosticsDependencies = {},
): Required<SystemDiagnosticsDependencies> {
  return {
    collectPreflightDiagnostics: dependencies.collectPreflightDiagnostics ?? defaultCollectPreflightDiagnostics,
    detectUnmigratedConfigs: dependencies.detectUnmigratedConfigs ?? defaultDetectUnmigratedConfigs,
    env: dependencies.env ?? process.env,
  };
}

function buildUnmigratedPiConfigsDiagnostic(paths: readonly string[]): PreflightDiagnostic | undefined {
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
  const diagnostics = [...dependencies.collectPreflightDiagnostics(input.preflightSource)];
  const unmigratedDiagnostic = buildUnmigratedPiConfigsDiagnostic(dependencies.detectUnmigratedConfigs(input.cwd));
  if (unmigratedDiagnostic) diagnostics.push(unmigratedDiagnostic);

  return {
    unhealthyDiagnostics: diagnostics.filter((diagnostic) => !diagnostic.healthy),
    shouldCheckForUpdates: dependencies.env.PI_OFFLINE !== '1',
  };
}
