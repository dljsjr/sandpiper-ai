import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { registerPreflightCheck } from 'sandpiper-ai-core';
import { registerRelayCleanupCommand } from './commands/relay-cleanup.js';
import { registerRelayConnectCommand } from './commands/relay-connect.js';
import { registerRelayStatusCommand } from './commands/relay-status.js';
import { checkShellIntegration } from './preflight.js';
import { createRelayRuntime } from './runtime.js';
import { registerInspectPaneTool } from './tools/inspect-pane.js';
import { registerStartRelayTool } from './tools/start-relay.js';

export default function (pi: ExtensionAPI) {
  registerPreflightCheck(pi, 'shell-relay:integration', checkShellIntegration);

  const runtime = createRelayRuntime(pi);

  registerStartRelayTool(pi, runtime);
  registerInspectPaneTool(pi, runtime);

  registerRelayConnectCommand(pi, runtime);
  registerRelayStatusCommand(pi, runtime);
  registerRelayCleanupCommand(pi, runtime);

  pi.on('session_start', async (event, ctx) => {
    switch (event.reason) {
      case 'startup':
      case 'reload':
        await runtime.onSessionReady(ctx);
        break;
      case 'new':
      case 'resume':
        await runtime.onSessionSwitch(ctx);
        break;
      case 'fork':
        runtime.restoreStoredSessionFromBranch(ctx.sessionManager.getBranch());
        break;
    }
  });

  pi.on('session_tree', async (_event, ctx) => {
    runtime.restoreStoredSessionFromBranch(ctx.sessionManager.getBranch());
  });

  pi.on('session_shutdown', async () => {
    await runtime.teardown();
  });
}
