import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  createEventBus,
  type ExtensionAPI,
  type ExtensionContext,
  type ExtensionToolContext,
} from '@earendil-works/pi-coding-agent';
import { afterEach, describe, expect, it, vi } from 'vitest';
import tattlerExtension from './index';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  delete process.env.XDG_RUNTIME_DIR;
  delete process.env.TATTLER_RUNTIME_NAMESPACE;
});

function fakePi(flags: Record<string, string> = {}) {
  const handlers = new Map<string, (evt: unknown, ctx: unknown) => unknown>();
  const pi = {
    events: createEventBus(),
    on: vi.fn((event: string, handler: (evt: unknown, ctx: unknown) => unknown) => {
      handlers.set(event, handler);
    }),
    registerTool: vi.fn(),
    registerCommand: vi.fn(),
    registerFlag: vi.fn(),
    registerMessageRenderer: vi.fn(),
    registerEntryRenderer: vi.fn(),
    getFlag: vi.fn((name: string) => flags[name]),
    appendEntry: vi.fn(),
    sendMessage: vi.fn(),
  } as unknown as ExtensionAPI;

  return { pi, handlers };
}

function fakeContext(sessionId: string, entries: unknown[]): ExtensionContext {
  return {
    isIdle: () => true,
    sessionManager: {
      getSessionId: () => sessionId,
      getEntries: () => entries,
    },
  } as unknown as ExtensionContext;
}

function setUpIsolatedRuntimeDir(namespace: string): void {
  // Unix domain socket paths are capped around ~104 bytes (macOS `sockaddr_un`); keep this
  // short rather than nesting under the OS tmpdir(), which on macOS is already a long path.
  const runtimeParent = mkdtempSync('/tmp/tt-');
  tempDirs.push(runtimeParent);
  process.env.XDG_RUNTIME_DIR = runtimeParent;
  process.env.TATTLER_RUNTIME_NAMESPACE = namespace;
}

describe('Tattler tools', () => {
  it('registers its tools as deferred, so tool_search loads them', async () => {
    setUpIsolatedRuntimeDir('tt-deferred');
    const { pi, handlers } = fakePi();
    await tattlerExtension(pi);

    await handlers.get('session_start')?.({ type: 'session_start', reason: 'startup' }, fakeContext('sess-d', []));

    const registered = vi.mocked(pi.registerTool).mock.calls.map(([tool]) => [tool.name, tool.exposure]);
    expect(registered).toEqual([
      ['tattler_receive', 'deferred'],
      ['list_peers', 'deferred'],
      ['send_peer_message', 'deferred'],
    ]);
    await handlers.get('session_shutdown')?.({ type: 'session_shutdown', reason: 'quit' }, fakeContext('sess-d', []));
  });

  it('reports a sent message as delivered, not as acknowledged by the peer', async () => {
    setUpIsolatedRuntimeDir('tt-send');
    const sender = fakePi({ 'tattler-id': 'alice' });
    const receiver = fakePi({ 'tattler-id': 'bob' });
    await tattlerExtension(sender.pi);
    await tattlerExtension(receiver.pi);
    await sender.handlers.get('session_start')?.(
      { type: 'session_start', reason: 'startup' },
      fakeContext('sess-s', []),
    );
    await receiver.handlers.get('session_start')?.(
      { type: 'session_start', reason: 'startup' },
      fakeContext('sess-r', []),
    );

    const sendTool = vi.mocked(sender.pi.registerTool).mock.calls.find(([tool]) => tool.name === 'send_peer_message');
    const result = await sendTool?.[0].execute(
      'call-1',
      { id: 'bob', message: 'hello' },
      undefined,
      undefined,
      {} as ExtensionToolContext,
    );

    const text = result?.content[0]?.type === 'text' ? result.content[0].text : '';
    expect(text).toMatch(/^Message \S+ delivered to bob\. /);
    expect(text).not.toMatch(/acknowledged/i);

    await sender.handlers.get('session_shutdown')?.(
      { type: 'session_shutdown', reason: 'quit' },
      fakeContext('sess-s', []),
    );
    await receiver.handlers.get('session_shutdown')?.(
      { type: 'session_shutdown', reason: 'quit' },
      fakeContext('sess-r', []),
    );
  });
});

describe('Tattler session lifecycle', () => {
  it('survives /reload: shutdown then session_start again for the same session without throwing', async () => {
    setUpIsolatedRuntimeDir('tt-reload');

    const { pi, handlers } = fakePi();
    await tattlerExtension(pi);

    const sessionStart = handlers.get('session_start');
    const sessionShutdown = handlers.get('session_shutdown');
    expect(sessionStart).toBeDefined();
    expect(sessionShutdown).toBeDefined();

    const sessionId = 'aaaa1111';
    const entries: unknown[] = [];
    (pi.appendEntry as ReturnType<typeof vi.fn>).mockImplementation((customType: string, data: unknown) => {
      entries.push({ type: 'custom', id: 'x', parentId: null, timestamp: new Date().toISOString(), customType, data });
    });

    await sessionStart?.({ type: 'session_start', reason: 'startup' }, fakeContext(sessionId, entries));

    // /reload keeps the same session (same id, same persisted `tattler-id` entry) and goes
    // through session_shutdown before session_start fires again — this used to throw EEXIST
    // recreating the identity tmpfile.
    await sessionShutdown?.({ type: 'session_shutdown', reason: 'reload' }, fakeContext(sessionId, entries));
    await sessionStart?.({ type: 'session_start', reason: 'reload' }, fakeContext(sessionId, entries));

    await sessionShutdown?.({ type: 'session_shutdown', reason: 'quit' }, fakeContext(sessionId, entries));
  });

  it('survives /new with a fixed --tattler-id (deterministic identity name) without throwing', async () => {
    setUpIsolatedRuntimeDir('tt-new-fid');

    const { pi, handlers } = fakePi({ 'tattler-id': 'fixed-name' });
    await tattlerExtension(pi);

    const sessionStart = handlers.get('session_start');
    const sessionShutdown = handlers.get('session_shutdown');

    await sessionStart?.({ type: 'session_start', reason: 'startup' }, fakeContext('sess-a', []));
    await sessionShutdown?.({ type: 'session_shutdown', reason: 'new' }, fakeContext('sess-a', []));
    // /new creates a brand-new session (fresh id, no persisted entries), but with a fixed
    // --tattler-id flag the identity *name* — and so the identity tmpfile path — collides
    // with the one from the session we just tore down.
    await sessionStart?.({ type: 'session_start', reason: 'new' }, fakeContext('sess-b', []));

    await sessionShutdown?.({ type: 'session_shutdown', reason: 'quit' }, fakeContext('sess-b', []));
  });

  it('keeps one exit listener for its socket across /reload and drops it at shutdown', async () => {
    setUpIsolatedRuntimeDir('tt-exit');
    const baseline = process.listenerCount('exit');
    const { pi, handlers } = fakePi();
    await tattlerExtension(pi);
    const entries: unknown[] = [];

    await handlers.get('session_start')?.(
      { type: 'session_start', reason: 'startup' },
      fakeContext('eeee3333', entries),
    );
    expect(process.listenerCount('exit')).toBe(baseline + 1);
    await handlers.get('session_shutdown')?.(
      { type: 'session_shutdown', reason: 'reload' },
      fakeContext('eeee3333', entries),
    );
    await handlers.get('session_start')?.(
      { type: 'session_start', reason: 'reload' },
      fakeContext('eeee3333', entries),
    );
    expect(process.listenerCount('exit')).toBe(baseline + 1);
    await handlers.get('session_shutdown')?.(
      { type: 'session_shutdown', reason: 'quit' },
      fakeContext('eeee3333', entries),
    );
    expect(process.listenerCount('exit')).toBe(baseline);
  });

  it('does not leave a stale identity file behind after /reload', async () => {
    setUpIsolatedRuntimeDir('tt-reload-id');

    const { pi, handlers } = fakePi();
    await tattlerExtension(pi);
    const sessionStart = handlers.get('session_start');
    const sessionShutdown = handlers.get('session_shutdown');

    const sessionId = 'ffff2222';
    const entries: unknown[] = [];
    (pi.appendEntry as ReturnType<typeof vi.fn>).mockImplementation((customType: string, data: unknown) => {
      entries.push({ type: 'custom', id: 'x', parentId: null, timestamp: new Date().toISOString(), customType, data });
    });

    await sessionStart?.({ type: 'session_start', reason: 'startup' }, fakeContext(sessionId, entries));
    await sessionShutdown?.({ type: 'session_shutdown', reason: 'reload' }, fakeContext(sessionId, entries));
    await sessionStart?.({ type: 'session_start', reason: 'reload' }, fakeContext(sessionId, entries));

    const runtimeDirPath = join(process.env.XDG_RUNTIME_DIR as string, 'tt-reload-id');
    const idFiles = readdirSync(runtimeDirPath).filter((name) => name.endsWith('.id'));
    expect(idFiles).toHaveLength(1);

    await sessionShutdown?.({ type: 'session_shutdown', reason: 'quit' }, fakeContext(sessionId, entries));
  });
});
