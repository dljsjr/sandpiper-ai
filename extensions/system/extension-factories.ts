import type { ExtensionAPI, ExtensionFactory } from '@earendil-works/pi-coding-agent';
import { checkForUpdates as checkForSandpiperUpdates, type UpdateInfo } from 'sandpiper-ai-core';
import { registerDiagnosticsHooks } from './diagnostics-hooks.js';
import { registerMigrationControls } from './migration-controls.js';
import {
  createNeutralCapabilityExtension,
  type NeutralCapabilityExtensionOptions,
} from './neutral-capability-extension.js';
import { createSystemRuntimeState, type SystemRuntimeState } from './runtime.js';
import { registerSessionContinuityHooks, registerStartupPromptHooks } from './startup-hooks.js';

export {
  createNeutralCapabilityExtension,
  type NeutralCapabilityExtensionOptions,
} from './neutral-capability-extension.js';

export interface SandpiperIdentityExtensionOptions {
  readonly checkForUpdates?: () => Promise<readonly UpdateInfo[]>;
  readonly dumpSystemPrompt?: boolean;
  readonly runtimeState?: SystemRuntimeState;
}

function defaultCheckForUpdates(): Promise<readonly UpdateInfo[]> {
  return checkForSandpiperUpdates({
    piCodingAgentVersion: process.env.PI_CODING_AGENT_VERSION,
    bunVersion: process.versions.bun,
  });
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
