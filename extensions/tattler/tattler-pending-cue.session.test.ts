import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type Api,
  type AssistantMessage,
  type Context,
  createAssistantMessageEventStream,
  type Model,
} from '@earendil-works/pi-ai';
import {
  createAgentSession,
  DefaultResourceLoader,
  type ExtensionAPI,
  SessionManager,
  SettingsManager,
} from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { afterEach, describe, expect, it } from 'vitest';
import tattlerExtension from './index';
import { sendAgentMessage } from './tattler-ipc';
import { requestOwnIdentity } from './tattler-pi-events';
import { buildMessage } from './tattler-protocol';

const CUE_TEXT = 'Pending Tattler/Chorus messages arrived while you were busy';
const PEER_MESSAGE = 'hello from a peer';
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

async function deliverPeerMessageToSelf(pi: ExtensionAPI): Promise<void> {
  const ownIdentity = await requestOwnIdentity(pi);
  await sendAgentMessage(
    ownIdentity,
    buildMessage('tattler.agent-message.v0', { message: PEER_MESSAGE, from: 'peer' }),
  );
}

// A provider that records every request. With firstResponseCallsTool, its first response calls a
// tool that delivers a Tattler message to this session's own socket while the run is active; every
// other response ends the turn.
function createProbeExtension(requests: string[], firstResponseCallsTool: boolean) {
  return (pi: ExtensionAPI) => {
    pi.registerTool({
      name: DELIVER_TOOL,
      label: 'Deliver peer message',
      description: 'Test fixture: delivers a Tattler message to this session while it is busy.',
      parameters: Type.Object({}),
      async execute() {
        await deliverPeerMessageToSelf(pi);
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
        const output = assistantMessage(model, firstResponseCallsTool && requests.length === 1);
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

// Delivers a Tattler message from its before_agent_start handler. Registered after Tattler, so it
// runs once Tattler's own handler has drained the pending inbox: the run is starting but not yet
// running, and Pi 1.2.0+ counts the session as busy.
function deliverDuringRunSetup(pi: ExtensionAPI): void {
  let delivered = false;
  pi.on('before_agent_start', async () => {
    if (delivered) return;
    delivered = true;
    await deliverPeerMessageToSelf(pi);
  });
}

async function promptProbeSession(extensionFactories: Array<(pi: ExtensionAPI) => void>): Promise<void> {
  // Unix domain socket paths are capped around ~104 bytes on macOS; keep the runtime dir short.
  setEnv('XDG_RUNTIME_DIR', tempDir('/tmp', 'tt-'));
  setEnv('TATTLER_RUNTIME_NAMESPACE', 'tt-cue');
  setEnv('PI_OFFLINE', '1');
  setEnv('PI_SKIP_VERSION_CHECK', '1');
  const agentDir = tempDir(tmpdir(), 'sandpiper-tattler-cue-');
  const cwd = tempDir(tmpdir(), 'sandpiper-tattler-cue-cwd-');

  const settingsManager = SettingsManager.inMemory();
  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    extensionFactories: [tattlerExtension, ...extensionFactories],
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
  } finally {
    session.dispose();
  }
}

describe('Tattler pending inbox cue in a real Pi session', () => {
  it('cues the model in the same run when a peer message arrives mid-run, then delivers it when the run settles', async () => {
    const requests: string[] = [];

    await promptProbeSession([createProbeExtension(requests, true)]);

    expect(requests).toHaveLength(3);
    expect(requests[0]).not.toContain(CUE_TEXT);
    expect(requests[1]).toContain(CUE_TEXT);
    expect(requests[1]).not.toContain(PEER_MESSAGE);
    expect(requests[2]).toContain(PEER_MESSAGE);
  });

  it('cues the model in the same run when a peer message arrives during run setup, then delivers it when the run settles', async () => {
    const requests: string[] = [];

    await promptProbeSession([createProbeExtension(requests, false), deliverDuringRunSetup]);

    expect(requests).toHaveLength(2);
    expect(requests[0]).toContain(CUE_TEXT);
    expect(requests[1]).toContain(PEER_MESSAGE);
  });
});
