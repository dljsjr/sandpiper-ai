import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { Type } from '@sinclair/typebox';
import type { RelayRuntime } from '../types.js';
import { withRelaySetup } from './with-relay-setup.js';

export function registerInspectPaneTool(pi: ExtensionAPI, runtime: RelayRuntime): void {
  pi.registerTool({
    name: 'shell_relay_inspect',
    label: 'Inspect Relay Pane',
    description:
      'View the current visual state of the shared terminal pane. ' +
      'Use this to see what the user has done in the pane, inspect TUI output, ' +
      'or check the state of an interactive program.',
    promptSnippet: "View the shared terminal's current visual state",
    parameters: Type.Object({
      session: Type.Optional(
        Type.String({
          description: 'Zellij session name (uses current relay session if not provided)',
        }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return withRelaySetup(
        runtime,
        ctx,
        params.session,
        (msg) => `Shell Relay setup failed: ${msg}\n\nCannot inspect pane — the relay is not connected.`,
        async () => {
          try {
            const content = runtime.inspectPane();
            return {
              content: [{ type: 'text', text: content || '(empty pane)' }],
              details: { lines: content.split('\n').length },
            };
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return {
              content: [
                {
                  type: 'text',
                  text:
                    `Inspect failed: ${msg}\n\n` +
                    'The Zellij pane may have been closed or the session may be unavailable.',
                },
              ],
              details: { error: msg },
              isError: true,
            };
          }
        },
      );
    },
  });
}
