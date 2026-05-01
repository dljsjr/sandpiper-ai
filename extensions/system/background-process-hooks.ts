import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import type { ProcessManager } from 'sandpiper-ai-core';

export function registerBackgroundProcessContextHooks(pi: ExtensionAPI, processManager: ProcessManager): void {
  pi.on('context', async (event) => {
    const completed = processManager.getCompletedUnacknowledged();
    if (completed.length === 0) return;

    const lines = completed.map((p) => `Background process "${p.id}" exited with code ${p.exitCode}.`);
    for (const p of completed) processManager.acknowledge(p.id);

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
