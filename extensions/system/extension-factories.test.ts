import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { describe, expect, it, vi } from 'vitest';
import {
  createBackgroundProcessExtension,
  createContextManagementExtension,
  createSandpiperIdentityExtension,
  createSkillLoadingExtension,
  createTurnControlExtension,
} from './extension-factories.js';

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
    | 'registerTool'
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
      events: {
        on: vi.fn(),
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
      registerTool: ((tool: { readonly name: string }) => {
        tools.push(tool.name);
      }) as ExtensionAPI['registerTool'],
      registerEntryRenderer: vi.fn() as ExtensionAPI['registerEntryRenderer'],
      appendEntry: vi.fn() as ExtensionAPI['appendEntry'],
    },
    commands,
    events,
    flags,
    tools,
  };
}

describe('system extension factory split', () => {
  it('registers each neutral capability as an independent extension', () => {
    const skillLoading = createExtensionCapture();
    createSkillLoadingExtension()(skillLoading.pi as ExtensionAPI);
    expect(skillLoading.tools).toEqual(['skill']);
    expect(skillLoading.events).toEqual([]);

    const turnControl = createExtensionCapture();
    createTurnControlExtension()(turnControl.pi as ExtensionAPI);
    expect(turnControl.tools).toEqual(['done']);
    expect(turnControl.events).toEqual([]);

    const contextManagement = createExtensionCapture();
    createContextManagementExtension()(contextManagement.pi as ExtensionAPI);
    expect(contextManagement.tools).toEqual([]);
    expect(contextManagement.events).toEqual(['turn_end']);

    const backgroundProcess = createExtensionCapture();
    createBackgroundProcessExtension()(backgroundProcess.pi as ExtensionAPI);
    expect(backgroundProcess.tools).toEqual(['start_background_process', 'check_background_process']);
    expect(backgroundProcess.events).toEqual(['session_shutdown']);

    for (const capture of [skillLoading, turnControl, contextManagement, backgroundProcess]) {
      expect(capture.flags).toEqual([]);
    }
  });

  it('registers an opt-in system prompt diagnostic command', () => {
    const { pi, commands } = createExtensionCapture();

    createSandpiperIdentityExtension({
      checkForUpdates: async () => [],
      systemPromptDiagnostic: {
        commandName: '__sandpiper-system-prompt',
        onPrompt: vi.fn(),
      },
    })(pi as ExtensionAPI);

    expect(commands).toContain('__sandpiper-system-prompt');
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
      'session_start', // registerMigrationControls
      'session_start', // registerStartupPromptHooks
      'session_shutdown', // registerStartupPromptHooks
      'before_agent_start', // registerStartupPromptHooks
      'session_start', // registerSessionContinuityHooks
      'session_shutdown', // registerSessionContinuityHooks
      'session_start', // registerDiagnosticsHooks
      'session_start', // registerStartupHeader
    ]);
  });
});
