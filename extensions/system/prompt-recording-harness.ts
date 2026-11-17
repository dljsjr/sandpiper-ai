// Test support: runs a real in-process Pi agent session against a provider that records every
// request instead of calling a model. Used by the prompt ownership, tool-section, and prompt
// diagnostic tests. No network, credentials, or real user state: the caller supplies a temp
// agent dir and cwd.
import {
  type Api,
  type AssistantMessage,
  createAssistantMessageEventStream,
  getCurrentSystemPrompt,
  type JsonObject,
  type Message,
  type Model,
  type TranscriptContext,
} from '@earendil-works/pi-ai';
import {
  type AgentSession,
  createAgentSession,
  DefaultResourceLoader,
  type ExtensionAPI,
  type ExtensionFactory,
  SessionManager,
  SettingsManager,
} from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

export const RECORDING_PROVIDER = 'prompt-recorder';
export const RECORDING_MODEL = 'recorder-1';
export const NOOP_TOOL = 'noop';

/**
 * 'toolCall' calls the harness's noop tool; `{ toolCall }` calls the named tool with `arguments`, or
 * with no arguments when they are left out.
 */
export type ScriptedResponse = 'text' | 'toolCall' | { readonly toolCall: string; readonly arguments?: JsonObject };

export interface RecordedRequest {
  readonly messages: readonly Message[];
  readonly systemPrompt: string;
}

export interface PromptRecordingSessionOptions {
  readonly cwd: string;
  readonly agentDir: string;
  readonly extensions: readonly ExtensionFactory[];
  /** Defaults to an in-memory session. Pass a file-backed manager to test resume. */
  readonly sessionManager?: SessionManager;
  /** Response for each provider call, in order; calls beyond the script answer with text. */
  readonly responses?: readonly ScriptedResponse[];
}

export interface PromptRecordingSession {
  readonly session: AgentSession;
  /** The harness extension's API, for changing the active tools between runs. */
  readonly extensionApi: ExtensionAPI;
  readonly requests: readonly RecordedRequest[];
  /** Run a user-prompted turn and wait for it to finish. */
  prompt(text: string): Promise<void>;
  /** Start a run from an extension while idle, as Tattler and background-process wakes do. */
  triggerSyntheticTurn(content?: string): Promise<void>;
  dispose(): void;
}

function assistantMessage(model: Model<Api>, response: ScriptedResponse, callNumber: number): AssistantMessage {
  const toolName = response === 'text' ? undefined : response === 'toolCall' ? NOOP_TOOL : response.toolCall;
  return {
    role: 'assistant',
    content:
      toolName === undefined
        ? [{ type: 'text', text: 'ok' }]
        : [
            {
              type: 'toolCall',
              id: `call-${callNumber}`,
              name: toolName,
              arguments: typeof response === 'object' ? { ...response.arguments } : {},
            },
          ],
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
    stopReason: toolName === undefined ? 'stop' : 'toolUse',
    timestamp: Date.now(),
  };
}

export async function createPromptRecordingSession(
  options: PromptRecordingSessionOptions,
): Promise<PromptRecordingSession> {
  const requests: RecordedRequest[] = [];
  const responses = [...(options.responses ?? [])];
  let trigger: ExtensionAPI | undefined;
  let resolveAgentEnd: (() => void) | undefined;

  const recorderExtension: ExtensionFactory = (pi) => {
    trigger = pi;
    pi.on('agent_end', () => {
      resolveAgentEnd?.();
      resolveAgentEnd = undefined;
    });
    pi.registerTool({
      name: NOOP_TOOL,
      label: NOOP_TOOL,
      description: 'Does nothing.',
      parameters: Type.Object({}),
      async execute() {
        return { content: [{ type: 'text', text: 'done' }], details: undefined };
      },
    });
    pi.registerProvider(RECORDING_PROVIDER, {
      name: 'Prompt recorder',
      baseUrl: 'http://prompt-recorder.invalid',
      apiKey: 'unused',
      api: 'openai-completions',
      models: [
        {
          id: RECORDING_MODEL,
          name: 'Prompt recorder',
          reasoning: false,
          input: ['text'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 128_000,
          maxTokens: 4096,
        },
      ],
      streamSimple: (model: Model<Api>, context: TranscriptContext) => {
        requests.push({
          messages: structuredClone(context.messages) as Message[],
          systemPrompt: getCurrentSystemPrompt(context.messages),
        });
        const output = assistantMessage(model, responses.shift() ?? 'text', requests.length);
        const stream = createAssistantMessageEventStream();
        queueMicrotask(() => {
          stream.push({ type: 'start', partial: output });
          stream.push({ type: 'done', reason: output.stopReason === 'toolUse' ? 'toolUse' : 'stop', message: output });
          stream.end();
        });
        return stream;
      },
    });
  };

  const settingsManager = SettingsManager.inMemory();
  const resourceLoader = new DefaultResourceLoader({
    cwd: options.cwd,
    agentDir: options.agentDir,
    settingsManager,
    noSkills: true,
    noContextFiles: true,
    extensionFactories: [recorderExtension, ...options.extensions],
  });
  await resourceLoader.reload();
  const { session } = await createAgentSession({
    cwd: options.cwd,
    agentDir: options.agentDir,
    resourceLoader,
    settingsManager,
    sessionManager: options.sessionManager ?? SessionManager.inMemory(options.cwd),
  });
  await session.bindExtensions({ mode: 'print' });
  const model = session.modelRuntime.getModel(RECORDING_PROVIDER, RECORDING_MODEL);
  if (!model) {
    throw new Error('prompt recorder model is not registered');
  }
  await session.setModel(model);
  if (!trigger) {
    throw new Error('prompt recorder extension did not load');
  }
  const extensionApi = trigger;

  return {
    session,
    extensionApi,
    requests,
    async prompt(text) {
      await session.prompt(text);
      await session.waitForIdle();
    },
    async triggerSyntheticTurn(content = 'background process exited') {
      const agentEnd = new Promise<void>((resolve) => {
        resolveAgentEnd = resolve;
      });
      await extensionApi.sendMessage(
        { customType: 'prompt-recorder:wake', content, display: false },
        { triggerTurn: true, deliverAs: 'steer' },
      );
      await agentEnd;
      await session.waitForIdle();
    },
    dispose() {
      session.dispose();
    },
  };
}
