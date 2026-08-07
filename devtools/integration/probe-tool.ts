// Test-only fixture extension, not part of any real extension under test. Registers a single
// trivial tool that echoes back whatever arguments it was called with. Used by AGENT-252's
// scripted-tool-call tests to prove the mock provider's tool-call scripting round-trips
// correctly through pi's real tool-execution pipeline (RPC tool_execution_* events, argument
// delivery) without coupling that proof to any production extension's own tool logic -- that
// coverage is AGENT-253's job, against real extensions.

import { Type } from '@earendil-works/pi-ai';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export const PROBE_TOOL_NAME = 'sandpiper_integration_probe';

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: PROBE_TOOL_NAME,
    label: 'Integration Probe',
    description: 'Test fixture tool: echoes its arguments back as the tool result.',
    parameters: Type.Object({}, { additionalProperties: true }),
    async execute(_toolCallId, params) {
      return {
        content: [{ type: 'text', text: JSON.stringify(params) }],
        details: { receivedArguments: params },
      };
    },
  });
}
