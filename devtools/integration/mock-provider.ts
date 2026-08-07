// Loaded via -e on every isolated integration-test spawn (see harness.ts). Registers a
// provider that never performs real network I/O -- no fetch/http call exists anywhere in
// this file's streamSimple implementation, so it is structurally incapable of egress.
//
// Scripting (AGENT-252): a test drives a deterministic multi-turn conversation, including
// tool calls against the extension under test, by setting MOCK_SCRIPT_ENV_VAR to a JSON-
// encoded MockScript before spawning. Each streamSimple() call emits the step at the index
// equal to how many assistant messages already exist in context.messages -- not a call
// counter -- so scripting position is derived from actual conversation state (immune to
// retries) rather than an easily-desynced invocation count. Falls back to
// MOCK_REPLY_ENV_VAR's single canned text reply (AGENT-251's original scope) when no script
// is set, so existing single-reply callers are unaffected.
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

/** Env var a test can set before spawning to control the mock's single canned reply
 * (AGENT-251 scope, still supported when no script is set). */
export const MOCK_REPLY_ENV_VAR = 'SANDPIPER_INTEGRATION_MOCK_REPLY';
const DEFAULT_REPLY = 'ok';

/** Env var a test sets to a JSON-encoded {@link MockScript} for multi-turn/tool-calling
 * scripting (AGENT-252 scope). Takes precedence over {@link MOCK_REPLY_ENV_VAR} when set. */
export const MOCK_SCRIPT_ENV_VAR = 'SANDPIPER_INTEGRATION_MOCK_SCRIPT';

/** One scripted assistant turn: either a plain text reply (stopReason "stop") or a tool call
 * against the extension under test (stopReason "toolUse"). */
export type MockScriptStep =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'toolCall'; readonly toolName: string; readonly arguments: Record<string, unknown> };

export type MockScript = readonly MockScriptStep[];

/** Serializes a script for MOCK_SCRIPT_ENV_VAR. Tests should go through this rather than
 * hand-rolling JSON.stringify, so the encoding is one place to change if the shape evolves. */
export function encodeMockScript(script: MockScript): string {
  return JSON.stringify(script);
}

function decodeMockScript(raw: string): MockScript {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`${MOCK_SCRIPT_ENV_VAR} must decode to a JSON array, got: ${raw}`);
  }
  return parsed as MockScript;
}

function countAssistantMessages(context: Context): number {
  return context.messages.filter((message) => message.role === 'assistant').length;
}

function baseAssistantMessage(model: Model<Api>): AssistantMessage {
  return {
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
}

function emitTextStep(stream: AssistantMessageEventStream, output: AssistantMessage, text: string): void {
  const textBlock = { type: 'text' as const, text: '' };
  output.content.push(textBlock);
  const contentIndex = output.content.length - 1;
  stream.push({ type: 'text_start', contentIndex, partial: output });
  textBlock.text = text;
  stream.push({ type: 'text_delta', contentIndex, delta: text, partial: output });
  stream.push({ type: 'text_end', contentIndex, content: text, partial: output });
  output.stopReason = 'stop';
}

let mockToolCallSequence = 0;

function emitToolCallStep(
  stream: AssistantMessageEventStream,
  output: AssistantMessage,
  toolName: string,
  toolArguments: Record<string, unknown>,
): void {
  mockToolCallSequence += 1;
  const toolCallId = `mock-tool-call-${mockToolCallSequence}`;
  const argumentsJson = JSON.stringify(toolArguments);

  const toolCallBlock = { type: 'toolCall' as const, id: toolCallId, name: toolName, arguments: {} };
  output.content.push(toolCallBlock);
  const contentIndex = output.content.length - 1;
  stream.push({ type: 'toolcall_start', contentIndex, partial: output });
  toolCallBlock.arguments = toolArguments;
  stream.push({ type: 'toolcall_delta', contentIndex, delta: argumentsJson, partial: output });
  stream.push({
    type: 'toolcall_end',
    contentIndex,
    toolCall: { type: 'toolCall', id: toolCallId, name: toolName, arguments: toolArguments },
    partial: output,
  });
  output.stopReason = 'toolUse';
}

function resolveStep(context: Context): MockScriptStep {
  const rawScript = process.env[MOCK_SCRIPT_ENV_VAR];
  if (rawScript !== undefined) {
    const script = decodeMockScript(rawScript);
    const index = countAssistantMessages(context);
    const step = script[index];
    if (!step) {
      throw new Error(
        `Mock script exhausted: turn index ${index} has no step (script has ${script.length} steps). ` +
          'The scripted conversation ran longer than the test provided steps for.',
      );
    }
    return step;
  }

  return { type: 'text', text: process.env[MOCK_REPLY_ENV_VAR] ?? DEFAULT_REPLY };
}

function mockStreamSimple(
  model: Model<Api>,
  context: Context,
  _options?: SimpleStreamOptions,
): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();
  const output = baseAssistantMessage(model);
  const step = resolveStep(context);

  queueMicrotask(() => {
    stream.push({ type: 'start', partial: output });

    let reason: 'stop' | 'toolUse';
    if (step.type === 'text') {
      emitTextStep(stream, output, step.text);
      reason = 'stop';
    } else {
      emitToolCallStep(stream, output, step.toolName, step.arguments);
      reason = 'toolUse';
    }

    stream.push({ type: 'done', reason, message: output });
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
