import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type Api,
  type AssistantMessage,
  type Context,
  createAssistantMessageEventStream,
  type Model,
  Type,
} from '@earendil-works/pi-ai';
import {
  createAgentSession,
  DefaultResourceLoader,
  type ExtensionAPI,
  SessionManager,
  SettingsManager,
} from '@earendil-works/pi-coding-agent';
import { afterEach, describe, expect, it } from 'vitest';
import tattlerExtension from './index';
import { sendAgentMessage } from './tattler-ipc';
import { requestOwnIdentity } from './tattler-pi-events';
import { buildMessage } from './tattler-protocol';

const CUE_TEXT = 'Pending Tattler/Chorus messages arrived while you were busy';
const DELIVER_TOOL = 'deliver_peer_message';

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) {
    cleanup();
  }
});

function setEnv(name: string, value: string): void {
  const previous = process.env[name];
  process.env[name] = value;
  cleanups.push(() => {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  });
}

function tempDir(parent: string, prefix: string): string {
  const dir = mkdtempSync(join(parent, prefix));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function assistantMessage(model: Model<Api>, toolCall: boolean): AssistantMessage {
  return {
    role: 'assistant',
    content: toolCall
      ? [{ type: 'toolCall', id: 'call-deliver', name: DELIVER_TOOL, arguments: {} }]
      : [{ type: 'text', text: 'done' }],
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
    stopReason: toolCall ? 'toolUse' : 'stop',
    timestamp: Date.now(),
  };
}

// A provider whose first response calls a tool that delivers a Tattler message to this session's
// own socket while the run is active; later responses end the turn. Records every request.
function createProbeExtension(requests: string[]) {
  return (pi: ExtensionAPI) => {
    pi.registerTool({
      name: DELIVER_TOOL,
      label: 'Deliver peer message',
      description: 'Test fixture: delivers a Tattler message to this session while it is busy.',
      parameters: Type.Object({}),
      async execute() {
        const ownIdentity = await requestOwnIdentity(pi);
        await sendAgentMessage(
          ownIdentity,
          buildMessage('tattler.agent-message.v0', { message: 'hello from a peer', from: 'peer' }),
        );
        return { content: [{ type: 'text', text: 'delivered' }], details: {} };
      },
    });

    pi.registerProvider('probe', {
      name: 'Probe',
      baseUrl: 'http://probe.invalid',
      apiKey: 'unused',
      api: 'openai-completions',
      models: [
        {
          id: 'probe-1',
          name: 'Probe',
          reasoning: false,
          input: ['text'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 128000,
          maxTokens: 4096,
        },
      ],
      streamSimple: (model: Model<Api>, context: Context) => {
        requests.push(JSON.stringify(context.messages));
        const output = assistantMessage(model, requests.length === 1);
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
}

describe('Tattler pending inbox cue in a real Pi session', () => {
  it('reaches the model in the same run when a peer message arrives mid-run', async () => {
    // Unix domain socket paths are capped around ~104 bytes on macOS; keep the runtime dir short.
    setEnv('XDG_RUNTIME_DIR', tempDir('/tmp', 'tt-'));
    setEnv('TATTLER_RUNTIME_NAMESPACE', 'tt-cue');
    setEnv('PI_OFFLINE', '1');
    setEnv('PI_SKIP_VERSION_CHECK', '1');
    const agentDir = tempDir(tmpdir(), 'sandpiper-tattler-cue-');
    const cwd = tempDir(tmpdir(), 'sandpiper-tattler-cue-cwd-');

    const requests: string[] = [];
    const settingsManager = SettingsManager.inMemory();
    const resourceLoader = new DefaultResourceLoader({
      cwd,
      agentDir,
      settingsManager,
      extensionFactories: [tattlerExtension, createProbeExtension(requests)],
      noExtensions: true,
      noSkills: true,
      noPromptTemplates: true,
      noThemes: true,
      noContextFiles: true,
    });
    await resourceLoader.reload();

    const { session } = await createAgentSession({
      cwd,
      agentDir,
      resourceLoader,
      settingsManager,
      sessionManager: SessionManager.inMemory(cwd),
    });

    try {
      await session.bindExtensions({ mode: 'print' });
      const model = session.modelRuntime.getModel('probe', 'probe-1');
      if (!model) throw new Error('probe model was not registered');
      await session.setModel(model);

      await session.prompt('start');

      expect(requests).toHaveLength(2);
      expect(requests[0]).not.toContain(CUE_TEXT);
      expect(requests[1]).toContain(CUE_TEXT);
    } finally {
      session.dispose();
    }
  });
});
