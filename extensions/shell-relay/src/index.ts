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

  pi.on('session_start', async (_event, ctx) => {
    await runtime.onSessionReady(ctx);
  });

  pi.on('session_switch', async (_event, ctx) => {
    await runtime.onSessionSwitch(ctx);
  });

  pi.on('session_fork', async (_event, ctx) => {
    runtime.restoreStoredSessionFromBranch(ctx.sessionManager.getBranch());
  });

  pi.on('session_tree', async (_event, ctx) => {
    runtime.restoreStoredSessionFromBranch(ctx.sessionManager.getBranch());
  });

  pi.on('session_shutdown', async () => {
    await runtime.teardown();
  });
}
