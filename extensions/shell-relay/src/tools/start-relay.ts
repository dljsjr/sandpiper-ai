import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import type { RelayRuntime } from '../types.js';
import { executeShellRelayTool } from './operations.js';

export function registerStartRelayTool(pi: ExtensionAPI, runtime: RelayRuntime): void {
  pi.registerTool({
    name: 'shell_relay',
    label: 'Shell Relay',
    description:
      "Execute a command in the user's shared terminal session (Zellij pane). " +
      "The command runs in the user's authenticated shell with full session state " +
      '(environment, functions, auth tokens). Both user and agent can see and ' +
      'interact with the terminal in real time.',
    promptSnippet: "Execute commands in the user's shared terminal (inherits auth, env, functions)",
    promptGuidelines: [
      "Reserve shell_relay for commands that genuinely need the user's live shell/session state (1Password auth, interactive shell functions, non-exported env). Needing to chain commands or run something long-running is not such a reason: use start_background_process plus check_background_process for long work, and bash for general commands, even when shell_relay could run them.",
      'shell_relay executes in a visible shared terminal pane; the user can see commands and output in real time.',
    ],
    parameters: Type.Object({
      command: Type.String({
        description: "Command to execute in the user's shell session",
      }),
      timeout: Type.Optional(
        Type.Number({
          description: 'Timeout in seconds (default: 30)',
        }),
      ),
      session: Type.Optional(
        Type.String({
          description:
            'Zellij session name to connect to. If not provided, uses SHELL_RELAY_SESSION env var or creates a new session.',
        }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return executeShellRelayTool(runtime, ctx, params);
    },
  });
}
