import type { ExtensionAPI, ExtensionFactory } from '@earendil-works/pi-coding-agent';
import { ProcessManager } from 'sandpiper-ai-core';
import { registerBackgroundProcessLifecycleHooks } from './background-process-hooks.js';
import { registerBackgroundProcessTools } from './background-process-tools.js';
import { registerContextManagementHooks } from './context-management.js';
import { registerSkillLoadingTool } from './skill-loading-tool.js';
import { registerTurnControlTool } from './turn-control-tool.js';

export interface NeutralCapabilityExtensionOptions {
  readonly processManager?: ProcessManager;
}

export function createNeutralCapabilityExtension(options: NeutralCapabilityExtensionOptions = {}): ExtensionFactory {
  const processManager = options.processManager ?? new ProcessManager();

  return (pi: ExtensionAPI) => {
    registerSkillLoadingTool(pi);
    registerTurnControlTool(pi);
    registerContextManagementHooks(pi);
    registerBackgroundProcessTools(pi, processManager);
    registerBackgroundProcessLifecycleHooks(pi, processManager);
  };
}
