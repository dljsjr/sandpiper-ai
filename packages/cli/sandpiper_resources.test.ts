import { join } from 'node:path';
import type { ExtensionAPI, ExtensionFactory } from '@mariozechner/pi-coding-agent';
import { describe, expect, it, vi } from 'vitest';
import {
  createNeutralCapabilityExtensionFactories,
  createSandpiperExtensionFactories,
  resolveSandpiperResourcePaths,
} from './sandpiper_resources.js';

function createExtensionCapture(): {
  readonly pi: Pick<
    ExtensionAPI,
    'appendEntry' | 'events' | 'getFlag' | 'on' | 'registerCommand' | 'registerFlag' | 'registerTool'
  >;
  readonly commands: string[];
  readonly events: string[];
  readonly flags: string[];
  readonly tools: string[];
} {
  const commands: string[] = [];
  const events: string[] = [];
  const flags: string[] = [];
  const tools: string[] = [];

  return {
    pi: {
      appendEntry: vi.fn() as ExtensionAPI['appendEntry'],
      events: {
        on: vi.fn(),
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
      registerTool: ((tool: { readonly name: string }) => {
        tools.push(tool.name);
      }) as ExtensionAPI['registerTool'],
    },
    commands,
    events,
    flags,
    tools,
  };
}

function applyFactories(factories: readonly ExtensionFactory[]): ReturnType<typeof createExtensionCapture> {
  const capture = createExtensionCapture();
  for (const factory of factories) {
    factory(capture.pi as ExtensionAPI);
  }
  return capture;
}

describe('Sandpiper resource adapter', () => {
  it('maps the current repository resource roots explicitly', () => {
    const paths = resolveSandpiperResourcePaths('/repo');

    expect(paths.skillPaths).toEqual([join('/repo', 'skills', 'sandpiper'), join('/repo', 'skills', 'third-party')]);
    expect(paths.promptPaths).toEqual([join('/repo', 'prompts')]);
    expect(paths.themePaths).toEqual([join('/repo', 'themes')]);
  });

  it('can create neutral capability factories without Sandpiper identity behavior', () => {
    const { commands, events, flags, tools } = applyFactories(createNeutralCapabilityExtensionFactories('/repo'));

    expect(tools).toEqual(expect.arrayContaining(['start_background_process', 'check_background_process']));
    expect(tools).toEqual(expect.arrayContaining(['shell_relay', 'shell_relay_inspect', 'web_fetch']));
    expect(commands).not.toContain('migrate-pi');
    expect(events).not.toContain('before_agent_start');
    expect(flags).not.toContain('migrate-pi-configs');
    expect(flags).not.toContain('install-shell-integrations');
  });

  it('adds Sandpiper identity behavior exactly once for the Sandpiper distribution', () => {
    const { flags } = applyFactories(createSandpiperExtensionFactories('/repo'));

    expect(flags.filter((flag) => flag === 'migrate-pi-configs')).toHaveLength(1);
    expect(flags.filter((flag) => flag === 'install-shell-integrations')).toHaveLength(1);
  });
});
