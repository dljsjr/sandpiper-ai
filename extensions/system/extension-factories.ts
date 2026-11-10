import type { ExtensionAPI, ExtensionFactory } from '@earendil-works/pi-coding-agent';
import { registerDiagnosticsHooks } from './diagnostics-hooks.js';
import { registerMigrationControls } from './migration-controls.js';
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
  readonly dumpSystemPrompt?: boolean;
  readonly systemPromptDiagnostic?: StartupPromptDiagnosticCommand;
}

export function createSandpiperIdentityExtension(options: SandpiperIdentityExtensionOptions = {}): ExtensionFactory {
  const dumpSystemPrompt = options.dumpSystemPrompt ?? process.env.SANDPIPER_DUMP_SYSTEM_PROMPT === '1';

  return (pi: ExtensionAPI) => {
    registerMigrationControls(pi);
    registerStartupPromptHooks(pi, dumpSystemPrompt, options.systemPromptDiagnostic);
    registerSessionContinuityHooks(pi);
    registerDiagnosticsHooks(pi);
    registerStartupHeader(pi);
  };
}
