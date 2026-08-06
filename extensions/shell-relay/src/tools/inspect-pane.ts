import { Type } from '@earendil-works/pi-ai';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { RelayRuntime } from '../types.js';
import { executeInspectPaneTool } from './operations.js';

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
    // 'prefer': strict JSON-schema sampling when the model supports it, transparent fallback
    // otherwise. Single optional scalar field, no unions -- low risk.
    constrainedSampling: { type: 'json_schema', strict: 'prefer' },
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return executeInspectPaneTool(runtime, ctx, params);
    },
  });
}
