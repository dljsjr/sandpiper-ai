import type { ExtensionAPI, ExtensionFactory } from '@earendil-works/pi-coding-agent';
import { checkForUpdates as checkForSandpiperUpdates, type UpdateInfo } from 'sandpiper-ai-core';
import { registerDiagnosticsHooks } from './diagnostics-hooks.js';
import { registerMigrationControls } from './migration-controls.js';
import {
  type BackgroundProcessExtensionOptions,
  createBackgroundProcessExtension,
  createContextManagementExtension,
  createSkillLoadingExtension,
  createTurnControlExtension,
} from './neutral-capability-extension.js';
import { createSystemRuntimeState, type SystemRuntimeState } from './runtime.js';
import { registerStartupHeader } from './startup-header.js';
import {
  registerSessionContinuityHooks,
  registerStartupPromptHooks,
  type StartupPromptDiagnosticCommand,
} from './startup-hooks.js';

export {
  type BackgroundProcessExtensionOptions,
  createBackgroundProcessExtension,
  createContextManagementExtension,
  createSkillLoadingExtension,
  createTurnControlExtension,
} from './neutral-capability-extension.js';

export interface SandpiperIdentityExtensionOptions {
  readonly checkForUpdates?: () => Promise<readonly UpdateInfo[]>;
  readonly dumpSystemPrompt?: boolean;
  readonly runtimeState?: SystemRuntimeState;
  readonly systemPromptDiagnostic?: StartupPromptDiagnosticCommand;
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
    registerStartupPromptHooks(pi, dumpSystemPrompt, options.systemPromptDiagnostic);
    registerSessionContinuityHooks(pi, runtimeState);
    registerDiagnosticsHooks(pi, updateCheck);
    registerStartupHeader(pi);
  };
}

export function createSandpiperSystemExtension(
  identityOptions: SandpiperIdentityExtensionOptions = {},
  capabilityOptions: BackgroundProcessExtensionOptions = {},
): ExtensionFactory {
  const identityExtension = createSandpiperIdentityExtension(identityOptions);
  const skillLoadingExtension = createSkillLoadingExtension();
  const turnControlExtension = createTurnControlExtension();
  const contextManagementExtension = createContextManagementExtension();
  const backgroundProcessExtension = createBackgroundProcessExtension(capabilityOptions);

  return (pi: ExtensionAPI) => {
    identityExtension(pi);
    skillLoadingExtension(pi);
    turnControlExtension(pi);
    contextManagementExtension(pi);
    backgroundProcessExtension(pi);
  };
}
