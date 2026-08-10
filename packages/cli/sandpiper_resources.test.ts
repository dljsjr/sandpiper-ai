import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

import {
  createNeutralCapabilityExtensionFactories,
  createSandpiperExtensionFactories,
  resolveSandpiperResourcePaths,
} from './sandpiper_resources.js';

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
} {
  const commands: string[] = [];
  const events: string[] = [];
  const flags: string[] = [];
  const renderers: string[] = [];
  const tools: string[] = [];

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
      registerTool: ((tool: { readonly name: string }) => {
        tools.push(tool.name);
      }) as ExtensionAPI['registerTool'],
    },
    commands,
    events,
    flags,
    renderers,
    tools,
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
  it('maps source resource roots through package-owned resources', () => {
    const paths = resolveSandpiperResourcePaths('/repo');

    expect(paths.skillPaths).toEqual([
      join('/repo', 'packages', 'resources', 'skills', 'sandpiper'),
      join('/repo', 'packages', 'resources', 'skills', 'third-party'),
    ]);
    expect(paths.skillPaths).not.toContain(join('/repo', 'packages', 'resources', 'skills-on-demand'));
    expect(paths.promptPaths).toEqual([join('/repo', 'packages', 'resources', 'prompts')]);
    expect(paths.themePaths).toEqual([join('/repo', 'packages', 'resources', 'themes')]);
  });

  it('prefers packaged top-level resource roots when they exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sandpiper-resource-root-'));
    try {
      mkdirSync(join(dir, 'skills'), { recursive: true });
      mkdirSync(join(dir, 'prompts'), { recursive: true });
      mkdirSync(join(dir, 'themes'), { recursive: true });

      const paths = resolveSandpiperResourcePaths(dir);

      expect(paths.skillPaths).toEqual([join(dir, 'skills', 'sandpiper'), join(dir, 'skills', 'third-party')]);
      expect(paths.skillPaths).not.toContain(join(dir, 'skills-on-demand'));
      expect(paths.promptPaths).toEqual([join(dir, 'prompts')]);
      expect(paths.themePaths).toEqual([join(dir, 'themes')]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('can create neutral capability factories without Sandpiper identity behavior', () => {
    const { commands, flags, renderers, tools } = applyFactories(createNeutralCapabilityExtensionFactories('/repo'));

    expect(tools).toEqual(expect.arrayContaining(['skill', 'start_background_process', 'check_background_process']));
    expect(tools).toEqual(expect.arrayContaining(['web_fetch']));
    expect(tools).not.toEqual(expect.arrayContaining(['shell_relay', 'shell_relay_inspect']));
    expect(tools).toContain('send_chorus_reply');
    expect(commands).toContain('chorus');
    expect(renderers).toContain('chorus-room-message');
    expect(commands).not.toContain('migrate-pi');
    expect(flags).not.toContain('identity');
    expect(flags).not.toContain('migrate-pi-configs');
    expect(flags).not.toContain('install-shell-integrations');
  });

  it('adds the opt-in system prompt diagnostic command to the identity extension', () => {
    const { commands } = applyFactories(
      createSandpiperExtensionFactories('/repo', {
        systemPromptDiagnostic: {
          commandName: '__sandpiper-system-prompt',
          onPrompt: vi.fn(),
        },
      }),
    );

    expect(commands).toContain('__sandpiper-system-prompt');
  });

  it('adds Sandpiper identity behavior exactly once for the Sandpiper distribution', () => {
    const { flags } = applyFactories(createSandpiperExtensionFactories('/repo'));

    expect(flags.filter((flag) => flag === 'migrate-pi-configs')).toHaveLength(1);
    expect(flags.filter((flag) => flag === 'install-shell-integrations')).toHaveLength(1);
  });
});
