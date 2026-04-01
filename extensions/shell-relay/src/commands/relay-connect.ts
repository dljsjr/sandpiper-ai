import { randomUUID } from 'node:crypto';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { deriveRelaySessionName } from '../session-lifecycle.js';
import type { RelayRuntime } from '../types.js';
import { ZellijClient } from '../zellij.js';

export function registerRelayConnectCommand(pi: ExtensionAPI, runtime: RelayRuntime): void {
  pi.registerCommand('relay-connect', {
    description: 'Connect Shell Relay to a Zellij session (or create a new one)',
    handler: async (_args, ctx) => {
      if (runtime.isSetUp()) {
        const reconnect = await ctx.ui.confirm(
          'Shell Relay is already connected',
          'Disconnect and connect to a different session?',
        );
        if (!reconnect) return;
        await runtime.teardown();
      }

      const probe = new ZellijClient({ sessionName: '' });
      if (!probe.isAvailable()) {
        ctx.ui.notify('Zellij is not installed or not available. Install it from https://zellij.dev', 'error');
        return;
      }

      const sessions = probe.listSessions();
      const createNewOption = '+ Create new session';
      const selection = await ctx.ui.select('Select a Zellij session for Shell Relay:', [...sessions, createNewOption]);
      if (selection === undefined) return;

      let targetSession: string;
      if (selection === createNewOption) {
        const defaultName =
          runtime.getStoredSessionName() ?? deriveRelaySessionName(process.env.SANDPIPER_SESSION_ID ?? randomUUID());
        const name = await ctx.ui.input('Session name:', defaultName);
        if (!name) return;
        targetSession = name;
      } else {
        targetSession = selection;
      }

      try {
        await runtime.setup(ctx, targetSession);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(`Shell Relay: Failed to connect — ${msg}`, 'error');
      }
    },
  });
}
