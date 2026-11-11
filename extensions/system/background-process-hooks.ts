import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { ProcessManager } from '../../packages/core/src/process-manager.js';

export function registerBackgroundProcessLifecycleHooks(pi: ExtensionAPI, processManager: ProcessManager): void {
  pi.on('session_shutdown', async () => {
    processManager.killAll();
  });
}
