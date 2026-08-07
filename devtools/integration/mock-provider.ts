// Loaded via -e on every isolated integration-test spawn (see harness.ts). Registers a
// provider that never performs real network I/O -- no fetch/http call exists anywhere in
// this file's streamSimple implementation, so it is structurally incapable of egress,
// independent of the network-deny-guard extension's process-wide backstop.
//
// AGENT-251 scope: a single, deliberately trivial scripted reply (one canned text response
// per process, read from an env var so callers can vary it per test without touching this
// file). Multi-turn/tool-calling scripting is AGENT-252's extension of this same provider --
// this file is the foundation it builds on, not the final scripting surface.
//
// Known simplification, flagged rather than silently skipped: pi's ProviderConfig.streamSimple
// contract asks implementations to invoke options.onPayload/options.onResponse "matching
// built-in providers" (see pi-coding-agent's extensions/types.d.ts). Those hooks exist so
// `before_provider_request`/`after_provider_response` extension listeners still fire for a
// custom provider. This mock never constructs a real request/response to hand them, and no
// wave-1 test extension registers those hooks -- so they're intentionally not invoked here.
// Revisit if a future test needs that fidelity.

import {
  type Api,
  type AssistantMessage,
  type AssistantMessageEventStream,
  type Context,
  createAssistantMessageEventStream,
  type Model,
  type SimpleStreamOptions,
} from '@earendil-works/pi-ai';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export const MOCK_PROVIDER_ID = 'sandpiper-integration-mock';
export const MOCK_MODEL_ID = 'mock-1';

/** Env var a test can set before spawning to control the mock's single canned reply. */
export const MOCK_REPLY_ENV_VAR = 'SANDPIPER_INTEGRATION_MOCK_REPLY';
const DEFAULT_REPLY = 'ok';

function mockStreamSimple(
  model: Model<Api>,
  _context: Context,
  _options?: SimpleStreamOptions,
): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();
  const reply = process.env[MOCK_REPLY_ENV_VAR] ?? DEFAULT_REPLY;

  const output: AssistantMessage = {
    role: 'assistant',
    content: [],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: 'pending',
    timestamp: Date.now(),
  };

  queueMicrotask(() => {
    stream.push({ type: 'start', partial: output });

    const textBlock = { type: 'text' as const, text: '' };
    output.content.push(textBlock);
    const contentIndex = output.content.length - 1;
    stream.push({ type: 'text_start', contentIndex, partial: output });

    textBlock.text = reply;
    stream.push({ type: 'text_delta', contentIndex, delta: reply, partial: output });
    stream.push({ type: 'text_end', contentIndex, content: reply, partial: output });

    output.stopReason = 'stop';
    stream.push({ type: 'done', reason: 'stop', message: output });
    stream.end();
  });

  return stream;
}

export default function (pi: ExtensionAPI) {
  pi.registerProvider(MOCK_PROVIDER_ID, {
    name: 'Sandpiper Integration Mock',
    baseUrl: 'http://mock.invalid',
    apiKey: 'unused-mock-key',
    api: 'openai-completions',
    streamSimple: mockStreamSimple,
    models: [
      {
        id: MOCK_MODEL_ID,
        name: 'Sandpiper Integration Mock Model',
        reasoning: false,
        input: ['text'],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 4096,
      },
    ],
  });
}
