import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { describe, expect, it, vi } from 'vitest';
import { createNeutralCapabilityExtension, createSandpiperIdentityExtension } from './extension-factories.js';

function createExtensionCapture(): {
  readonly pi: Pick<ExtensionAPI, 'events' | 'getFlag' | 'on' | 'registerCommand' | 'registerFlag' | 'registerTool'>;
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

describe('system extension factory split', () => {
  it('registers neutral capabilities without Sandpiper identity hooks or flags', () => {
    const { pi, events, flags, tools } = createExtensionCapture();

    createNeutralCapabilityExtension()(pi as ExtensionAPI);

    expect(tools).toEqual(['skill', 'done', 'start_background_process', 'check_background_process']);
    expect(events).toEqual(['turn_end', 'session_shutdown']);
    expect(flags).toEqual([]);
  });

  it('registers Sandpiper identity behavior separately from neutral tools', () => {
    const { pi, commands, events, flags, tools } = createExtensionCapture();

    createSandpiperIdentityExtension({ dumpSystemPrompt: false, checkForUpdates: async () => [] })(pi as ExtensionAPI);

    expect(tools).toEqual([]);
    expect(commands).toEqual(['migrate-pi']);
    expect(flags).toEqual([
      'install-shell-integrations',
      'migrate-pi-configs',
      'symlink-config',
      'pi-configs-global',
      'pi-configs-local',
      'identity',
    ]);
    expect(events).toEqual([
      'session_start',
      'session_start',
      'session_shutdown',
      'before_agent_start',
      'session_start',
      'session_shutdown',
      'session_start',
    ]);
  });
});
