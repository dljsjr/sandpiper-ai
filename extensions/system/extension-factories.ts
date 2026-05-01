import type { ExtensionAPI, ExtensionFactory } from '@mariozechner/pi-coding-agent';
import { checkForUpdates as checkForSandpiperUpdates, ProcessManager, type UpdateInfo } from 'sandpiper-ai-core';
import { registerBackgroundProcessTools } from './background-process-tools.js';
import { registerDiagnosticsHooks } from './diagnostics-hooks.js';
import { registerMigrationControls } from './migration-controls.js';
import { createSystemRuntimeState, type SystemRuntimeState } from './runtime.js';
import {
  registerBackgroundProcessContextHooks,
  registerSessionContinuityHooks,
  registerStartupPromptHooks,
} from './startup-hooks.js';

export interface SandpiperIdentityExtensionOptions {
  readonly checkForUpdates?: () => Promise<readonly UpdateInfo[]>;
  readonly dumpSystemPrompt?: boolean;
  readonly runtimeState?: SystemRuntimeState;
}

export interface NeutralCapabilityExtensionOptions {
  readonly processManager?: ProcessManager;
}

function defaultCheckForUpdates(): Promise<readonly UpdateInfo[]> {
  return checkForSandpiperUpdates({
    piCodingAgentVersion: process.env.PI_CODING_AGENT_VERSION,
    bunVersion: process.versions.bun,
  });
}

export function createNeutralCapabilityExtension(options: NeutralCapabilityExtensionOptions = {}): ExtensionFactory {
  const processManager = options.processManager ?? new ProcessManager();

  return (pi: ExtensionAPI) => {
    registerBackgroundProcessTools(pi, processManager);
    registerBackgroundProcessContextHooks(pi, processManager);
  };
}

export function createSandpiperIdentityExtension(options: SandpiperIdentityExtensionOptions = {}): ExtensionFactory {
  const runtimeState = options.runtimeState ?? createSystemRuntimeState();
  const dumpSystemPrompt = options.dumpSystemPrompt ?? process.env.SANDPIPER_DUMP_SYSTEM_PROMPT === '1';
  const updateCheck = options.checkForUpdates ?? defaultCheckForUpdates;

  return (pi: ExtensionAPI) => {
    registerMigrationControls(pi);
    registerStartupPromptHooks(pi, runtimeState, dumpSystemPrompt);
    registerSessionContinuityHooks(pi, runtimeState);
    registerDiagnosticsHooks(pi, updateCheck);
  };
}

export function createSandpiperSystemExtension(
  identityOptions: SandpiperIdentityExtensionOptions = {},
  capabilityOptions: NeutralCapabilityExtensionOptions = {},
): ExtensionFactory {
  const identityExtension = createSandpiperIdentityExtension(identityOptions);
  const capabilityExtension = createNeutralCapabilityExtension(capabilityOptions);

  return (pi: ExtensionAPI) => {
    identityExtension(pi);
    capabilityExtension(pi);
  };
}
