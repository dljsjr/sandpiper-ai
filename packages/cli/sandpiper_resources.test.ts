import type { ExtensionAPI, InlineExtension } from '@earendil-works/pi-coding-agent';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// web-search's real adapter-selection resolves the Brave key via readSettingsKey, which reads
// the actual ~/.sandpiper/agent/settings.json -- and this developer's config resolves it through
// a `!op read ...` shell-out. Mock it the same way extensions/web-search/src/adapter-selection.test.ts
// does, so this cross-package test never touches real user config or invokes a real 1Password prompt.
vi.mock('../../extensions/web-search/src/config-resolver.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../extensions/web-search/src/config-resolver.js')>();
  return { ...actual, readSettingsKey: vi.fn(() => undefined) };
});

import { createNeutralCapabilityExtensionFactories, createSandpiperExtensionFactories } from './sandpiper_resources.js';

const savedBraveApiKey = process.env.BRAVE_API_KEY;

beforeEach(() => {
  delete process.env.BRAVE_API_KEY;
});

afterEach(() => {
  if (savedBraveApiKey === undefined) delete process.env.BRAVE_API_KEY;
  else process.env.BRAVE_API_KEY = savedBraveApiKey;
});

function createExtensionCapture(): {
  readonly pi: Pick<
    ExtensionAPI,
    | 'appendEntry'
    | 'events'
    | 'getFlag'
    | 'on'
    | 'registerCommand'
    | 'registerEntryRenderer'
    | 'registerFlag'
    | 'registerMessageRenderer'
    | 'registerTool'
  >;
  readonly commands: string[];
  readonly events: string[];
  readonly flags: string[];
  readonly renderers: string[];
  readonly tools: string[];
  readonly exposures: Map<string, string | undefined>;
} {
  const commands: string[] = [];
  const events: string[] = [];
  const flags: string[] = [];
  const renderers: string[] = [];
  const tools: string[] = [];
  const exposures = new Map<string, string | undefined>();

  return {
    pi: {
      appendEntry: vi.fn() as ExtensionAPI['appendEntry'],
      events: {
        on: vi.fn(() => vi.fn()),
        emit: vi.fn(),
      } as unknown as ExtensionAPI['events'],
      getFlag: vi.fn(() => false) as ExtensionAPI['getFlag'],
      on: ((event: string) => {
        events.push(event);
        return () => {};
      }) as ExtensionAPI['on'],
      registerCommand: ((name: string) => {
        commands.push(name);
      }) as ExtensionAPI['registerCommand'],
      registerFlag: ((name: string) => {
        flags.push(name);
      }) as ExtensionAPI['registerFlag'],
      registerEntryRenderer: vi.fn() as ExtensionAPI['registerEntryRenderer'],
      registerMessageRenderer: ((customType: string) => {
        renderers.push(customType);
      }) as ExtensionAPI['registerMessageRenderer'],
      registerTool: ((tool: { readonly name: string; readonly exposure?: string }) => {
        tools.push(tool.name);
        exposures.set(tool.name, tool.exposure);
      }) as ExtensionAPI['registerTool'],
    },
    commands,
    events,
    flags,
    renderers,
    tools,
    exposures,
  };
}

function applyFactories(factories: readonly InlineExtension[]): ReturnType<typeof createExtensionCapture> {
  const capture = createExtensionCapture();
  for (const factory of factories) {
    const fn = typeof factory === 'function' ? factory : factory.factory;
    fn(capture.pi as ExtensionAPI);
  }
  return capture;
}

describe('Sandpiper resource adapter', () => {
  it('adds the clock reading at the start of every run and records each run when it settles', async () => {
    const events: string[] = [];
    const pi = {
      ...createExtensionCapture().pi,
      on: ((event: string) => {
        events.push(event);
        return () => {};
      }) as ExtensionAPI['on'],
    };
    const clock = createNeutralCapabilityExtensionFactories().find(
      (extension) => typeof extension !== 'function' && extension.name === 'clock',
    );
    if (!clock || typeof clock === 'function') throw new Error('clock extension is missing');

    await clock.factory(pi as ExtensionAPI);

    expect(events).toEqual(['before_agent_start', 'agent_settled']);
  });

  it('can create neutral capability factories without Sandpiper identity behavior', () => {
    const { commands, flags, tools } = applyFactories(createNeutralCapabilityExtensionFactories());

    expect(tools).toEqual(expect.arrayContaining(['skill', 'start_background_process', 'check_background_process']));
    expect(tools).toEqual(expect.arrayContaining(['web_fetch']));
    // Chorus is parked until its rewrite: neither its tool nor its commands load.
    expect(tools).not.toContain('send_chorus_reply');
    expect(commands).not.toContain('chorus');
    expect(flags).not.toContain('identity');
  });

  it('defers the rarely used tools and keeps skill, done, and the background process tools loaded', () => {
    const { exposures } = applyFactories(createNeutralCapabilityExtensionFactories());

    for (const name of ['web_fetch', 'web_search', 'tattler_receive', 'stop_background_process']) {
      expect(exposures.get(name), name).toBe('deferred');
    }
    expect(exposures.has('skill')).toBe(true);
    expect(exposures.get('skill')).toBeUndefined();
    expect(exposures.has('done')).toBe(true);
    expect(exposures.get('done')).toBeUndefined();
    // Their guideline steers backgrounding away from bash, and Pi lists guidelines only for loaded tools.
    for (const name of ['start_background_process', 'check_background_process']) {
      expect(exposures.has(name), name).toBe(true);
      expect(exposures.get(name), name).toBeUndefined();
    }
  });

  it('adds the opt-in system prompt diagnostic command to the identity extension', () => {
    const { commands } = applyFactories(
      createSandpiperExtensionFactories({
        systemPromptDiagnostic: {
          commandName: '__sandpiper-system-prompt',
          onPrompt: vi.fn(),
        },
      }),
    );

    expect(commands).toContain('__sandpiper-system-prompt');
  });

  it('adds Sandpiper identity behavior exactly once for the Sandpiper distribution', () => {
    const { flags } = applyFactories(createSandpiperExtensionFactories());

    expect(flags.filter((flag) => flag === 'identity')).toHaveLength(1);
  });
});
