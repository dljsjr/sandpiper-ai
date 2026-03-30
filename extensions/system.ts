import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { checkForUpdates, ProcessManager } from 'sandpiper-ai-core';
import { registerBackgroundProcessTools } from './system/background-process-tools.js';
import { registerDiagnosticsHooks } from './system/diagnostics-hooks.js';
import { registerMigrationControls } from './system/migration-controls.js';
import { createSystemRuntimeState } from './system/runtime.js';
import {
  registerBackgroundProcessContextHooks,
  registerSessionContinuityHooks,
  registerStartupPromptHooks,
} from './system/startup-hooks.js';

const processManager = new ProcessManager();
const runtimeState = createSystemRuntimeState();

export default function (pi: ExtensionAPI) {
  registerBackgroundProcessTools(pi, processManager);
  registerMigrationControls(pi);
  registerStartupPromptHooks(pi, runtimeState);
  registerSessionContinuityHooks(pi, runtimeState);
  registerDiagnosticsHooks(pi, () =>
    checkForUpdates({
      piCodingAgentVersion: process.env.PI_CODING_AGENT_VERSION,
      bunVersion: process.versions.bun,
    }),
  );
  registerBackgroundProcessContextHooks(pi, processManager);
}
