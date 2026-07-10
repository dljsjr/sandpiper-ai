import type { ExtensionAPI, ExtensionFactory } from '@earendil-works/pi-coding-agent';
import { ProcessManager } from 'sandpiper-ai-core';
import { registerBackgroundProcessLifecycleHooks } from './background-process-hooks.js';
import { registerBackgroundProcessTools } from './background-process-tools.js';
import { registerContextManagementHooks } from './context-management.js';
import { registerSkillLoadingTool } from './skill-loading-tool.js';
import { registerTurnControlTool } from './turn-control-tool.js';

export function createSkillLoadingExtension(): ExtensionFactory {
  return (pi: ExtensionAPI) => {
    registerSkillLoadingTool(pi);
  };
}

export function createTurnControlExtension(): ExtensionFactory {
  return (pi: ExtensionAPI) => {
    registerTurnControlTool(pi);
  };
}

export function createContextManagementExtension(): ExtensionFactory {
  return (pi: ExtensionAPI) => {
    registerContextManagementHooks(pi);
  };
}

export interface BackgroundProcessExtensionOptions {
  readonly processManager?: ProcessManager;
}

export function createBackgroundProcessExtension(options: BackgroundProcessExtensionOptions = {}): ExtensionFactory {
  const processManager = options.processManager ?? new ProcessManager();

  return (pi: ExtensionAPI) => {
    registerBackgroundProcessTools(pi, processManager);
    registerBackgroundProcessLifecycleHooks(pi, processManager);
  };
}
