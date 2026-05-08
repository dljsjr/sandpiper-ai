import type { ExtensionAPI, ExtensionFactory } from '@earendil-works/pi-coding-agent';
import { ProcessManager } from 'sandpiper-ai-core';
import { registerBackgroundProcessContextHooks } from './background-process-hooks.js';
import { registerBackgroundProcessTools } from './background-process-tools.js';

export interface NeutralCapabilityExtensionOptions {
  readonly processManager?: ProcessManager;
}

export function createNeutralCapabilityExtension(options: NeutralCapabilityExtensionOptions = {}): ExtensionFactory {
  const processManager = options.processManager ?? new ProcessManager();

  return (pi: ExtensionAPI) => {
    registerBackgroundProcessTools(pi, processManager);
    registerBackgroundProcessContextHooks(pi, processManager);
  };
}
