import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { collectCompletedBackgroundProcessNotifications, type ProcessManager } from 'sandpiper-ai-core';

export function registerBackgroundProcessContextHooks(pi: ExtensionAPI, processManager: ProcessManager): void {
  pi.on('context', async (event) => {
    const completed = collectCompletedBackgroundProcessNotifications(processManager);
    if (completed.length === 0) return;

    const lines = completed.map(
      (process) => `Background process "${process.id}" exited with code ${process.exitCode}.`,
    );

    return {
      messages: [
        ...event.messages,
        {
          role: 'user',
          content: [{ type: 'text', text: lines.join('\n') }],
        } as (typeof event.messages)[number],
      ],
    };
  });

  pi.on('session_shutdown', async () => {
    processManager.killAll();
  });
}
