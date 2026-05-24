import { createEventBus, type ExtensionAPI, type ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import { describe, expect, test, vi } from 'vitest';
import chorusExtension from './chorus';

type RegisteredCommand = {
  readonly description?: string;
  readonly handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
};

function fakePi() {
  const commands = new Map<string, RegisteredCommand>();
  const pi = {
    events: createEventBus(),
    on: vi.fn(),
    registerCommand: vi.fn((name: string, command: RegisteredCommand) => {
      commands.set(name, command);
    }),
    registerMessageRenderer: vi.fn(),
    registerTool: vi.fn(),
    sendUserMessage: vi.fn(),
  } as unknown as ExtensionAPI;

  return { pi, commands };
}

describe('Chorus extension commands', () => {
  test('registers /agent as a discoverable local-agent escape hatch', async () => {
    const { pi, commands } = fakePi();
    chorusExtension(pi);

    const command = commands.get('agent');
    expect(command?.description).toContain('local agent');

    const notify = vi.fn();
    await command?.handler(' talk to the local agent ', {
      ui: { notify },
    } as unknown as ExtensionCommandContext);

    expect(pi.sendUserMessage).toHaveBeenCalledWith('talk to the local agent', { deliverAs: 'steer' });
    expect(notify).toHaveBeenCalledWith('Chorus: sent direct prompt to local agent', 'info');
  });

  test('shows usage when /agent has no message', async () => {
    const { pi, commands } = fakePi();
    chorusExtension(pi);

    const notify = vi.fn();
    await commands.get('agent')?.handler('   ', {
      ui: { notify },
    } as unknown as ExtensionCommandContext);

    expect(pi.sendUserMessage).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith('Usage: /agent <message>', 'warning');
  });
});
