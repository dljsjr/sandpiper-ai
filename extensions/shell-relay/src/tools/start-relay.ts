import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { Type } from '@sinclair/typebox';
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
      "Use shell_relay instead of bash when the command requires the user's session state (e.g., 1Password auth, shell functions, non-exported env vars).",
      "Use bash for general-purpose commands that don't need session state — it's faster and simpler.",
      'shell_relay executes in a visible Zellij pane — the user can see all commands and output in real time.',
      'The shared terminal is fully collaborative — the user may run commands between your invocations.',
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
