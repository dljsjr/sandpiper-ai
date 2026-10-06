import { mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Message } from '@earendil-works/pi-ai';
import { type ExtensionFactory, SessionManager } from '@earendil-works/pi-coding-agent';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPromptRecordingSession, type PromptRecordingSession } from './prompt-recording-harness.js';
import { registerStartupPromptHooks } from './startup-hooks.js';

const SANDPIPER_PROMPT_START = '<system_prompt>';
const PI_DEFAULT_PREAMBLE = 'operating inside pi, a coding agent harness';

const sandpiperPromptExtension: ExtensionFactory = (pi) => registerStartupPromptHooks(pi);

let root: string;
let open: PromptRecordingSession[] = [];

async function startSession(
  options: Partial<Parameters<typeof createPromptRecordingSession>[0]> = {},
): Promise<PromptRecordingSession> {
  const recording = await createPromptRecordingSession({
    cwd: join(root, 'project'),
    agentDir: join(root, 'agent'),
    extensions: [sandpiperPromptExtension],
    ...options,
  });
  open.push(recording);
  return recording;
}

const mcpServersSectionExtension: ExtensionFactory = (pi) => {
  pi.on('before_agent_start', (event) => {
    event.systemPromptOptions.sections.mcp_servers = '- mcp__linear (codemode): Linear issue tracker';
  });
};

function isSandpiperPrompt(systemPrompt: string): boolean {
  return systemPrompt.startsWith(SANDPIPER_PROMPT_START);
}

function systemMessageCount(messages: readonly Message[]): number {
  return messages.filter((message) => message.role === 'system').length;
}

function expectPrefix(previous: readonly Message[], next: readonly Message[]): void {
  expect(JSON.stringify(next.slice(0, previous.length))).toBe(JSON.stringify(previous));
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'sandpiper-prompt-ownership-'));
  mkdirSync(join(root, 'project'));
  mkdirSync(join(root, 'agent'));
  mkdirSync(join(root, 'home'));
  vi.stubEnv('HOME', join(root, 'home'));
  vi.stubEnv('PI_CODING_AGENT_DIR', join(root, 'agent'));
});

afterEach(() => {
  for (const recording of open) recording.dispose();
  open = [];
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe('Sandpiper prompt ownership on Pi 1.0', () => {
  it('sends the Sandpiper prompt on a user-prompted run', async () => {
    const recording = await startSession();

    await recording.prompt('hello');

    expect(recording.requests).toHaveLength(1);
    expect(isSandpiperPrompt(recording.requests[0]?.systemPrompt ?? '')).toBe(true);
  });

  it('records the Sandpiper prompt where /export reads it', async () => {
    const recording = await startSession();

    await recording.prompt('hello');

    expect(isSandpiperPrompt(recording.session.state.systemPrompt)).toBe(true);
  });

  it('keeps the Sandpiper prompt on every turn of an idle synthetic run', async () => {
    const recording = await startSession({ responses: ['text', 'toolCall', 'text'] });
    await recording.prompt('hello');

    await recording.triggerSyntheticTurn();

    const syntheticRunRequests = recording.requests.slice(1);
    expect(syntheticRunRequests).toHaveLength(2);
    for (const request of syntheticRunRequests) {
      expect(isSandpiperPrompt(request.systemPrompt)).toBe(true);
      expect(request.systemPrompt).not.toContain(PI_DEFAULT_PREAMBLE);
    }
    expect(isSandpiperPrompt(recording.session.state.systemPrompt)).toBe(true);
  });

  it('adds no system prompt change during an idle synthetic run', async () => {
    const recording = await startSession({ responses: ['text', 'toolCall', 'text'] });
    await recording.prompt('hello');

    await recording.triggerSyntheticTurn();

    for (const request of recording.requests) {
      expect(systemMessageCount(request.messages)).toBe(1);
    }
  });

  it('extends each request byte-for-byte across synthetic and user-prompted runs', async () => {
    const recording = await startSession({ responses: ['text', 'toolCall', 'text', 'text'] });
    await recording.prompt('hello');
    await recording.triggerSyntheticTurn();

    await recording.prompt('next');

    expect(recording.requests).toHaveLength(4);
    for (let index = 1; index < recording.requests.length; index++) {
      expectPrefix(recording.requests[index - 1]?.messages ?? [], recording.requests[index]?.messages ?? []);
    }
  });

  it('keeps extension sections on idle synthetic turns', async () => {
    const recording = await startSession({
      extensions: [sandpiperPromptExtension, mcpServersSectionExtension],
      responses: ['text', 'toolCall', 'text'],
    });
    await recording.prompt('hello');

    await recording.triggerSyntheticTurn();

    for (const request of recording.requests) {
      expect(request.systemPrompt).toContain(
        '<mcp_servers>\n- mcp__linear (codemode): Linear issue tracker\n</mcp_servers>',
      );
    }
  });

  it('sends the Sandpiper prompt after resuming a session, including on a synthetic turn first', async () => {
    const sessionDir = join(root, 'sessions');
    const first = await startSession({ sessionManager: SessionManager.create(join(root, 'project'), sessionDir) });
    await first.prompt('hello');
    first.dispose();
    open = [];
    const [sessionFile] = readdirSync(sessionDir);

    const resumed = await startSession({
      sessionManager: SessionManager.open(join(sessionDir, sessionFile ?? ''), sessionDir),
      responses: ['toolCall', 'text', 'text'],
    });
    await resumed.triggerSyntheticTurn();
    await resumed.prompt('after resume');

    expect(resumed.requests).toHaveLength(3);
    for (const request of resumed.requests) {
      expect(isSandpiperPrompt(request.systemPrompt)).toBe(true);
    }
  });

  it("leaves a fresh session's synthetic first run on Pi's own prompt (documented first-turn gap)", async () => {
    const recording = await startSession({ responses: ['toolCall', 'text'] });

    await recording.triggerSyntheticTurn();

    expect(recording.requests.map((request) => request.systemPrompt.slice(0, 40))).toEqual([
      '',
      expect.stringContaining('You are an expert coding assistant'),
    ]);
  });
});

describe('SANDPIPER_DUMP_SYSTEM_PROMPT', () => {
  it('dumps the prompt the provider receives, including the sections Pi adds', async () => {
    const dumped: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      dumped.push(args.map(String).join(' '));
    });
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const recording = await startSession({ extensions: [(pi) => registerStartupPromptHooks(pi, true)] });

    await recording.prompt('hello');

    expect(dumped).toEqual([`system prompt:\n ${recording.requests[0]?.systemPrompt}`]);
    expect(dumped[0]).toContain(`<cwd>\n${join(root, 'project')}\n</cwd>`);
  });
});
