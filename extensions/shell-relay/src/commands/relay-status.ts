import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import type { RelayRuntime } from '../types.js';

export function registerRelayStatusCommand(pi: ExtensionAPI, runtime: RelayRuntime): void {
  pi.registerCommand('relay-status', {
    description: 'Show Shell Relay connection status',
    handler: async (_args, ctx) => {
      if (!runtime.isSetUp()) {
        ctx.ui.notify('Shell Relay: Not connected. Use /relay-connect to connect.', 'info');
        return;
      }

      const details = runtime.getStatusDetails();
      ctx.ui.notify(
        `Shell Relay: Connected\n  Session: ${details.sessionName}\n  Shell: ${details.shell}\n  Pane: ${details.paneId}\n  Signal FIFO: ${details.signalPath}`,
        'info',
      );
    },
  });
}
