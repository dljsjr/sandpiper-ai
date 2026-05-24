import { createEventBus, type ExtensionAPI, type ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import { describe, expect, test, vi } from 'vitest';
import chorusExtension, { sendChorusSelfMessageToChatWhenIdle } from './chorus';
import { roomId, type TattlerMessageId } from './tattler/tattler-protocol';

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
    sendMessage: vi.fn(),
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

  test('defers display-only self chat messages until the agent is idle', async () => {
    vi.useFakeTimers();
    try {
      const { pi } = fakePi();
      let idle = false;

      sendChorusSelfMessageToChatWhenIdle(
        pi,
        { isIdle: () => idle },
        {
          roomId: roomId('chorus-dev'),
          from: 'Piper',
          message: 'local reply',
          postId: 'post-1' as TattlerMessageId,
          broker: { name: 'chorus:chorus-dev', shortId: 'chorus-dev', socketPath: '/tmp/chorus.sock' },
          self: true,
        },
      );

      expect(pi.sendMessage).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(25);
      expect(pi.sendMessage).not.toHaveBeenCalled();

      idle = true;
      await vi.advanceTimersByTimeAsync(25);

      expect(pi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          customType: 'chorus-room-message',
          content: '',
          display: true,
          details: expect.objectContaining({ from: 'Piper', message: 'local reply', self: true }),
        }),
        { triggerTurn: false, deliverAs: 'steer' },
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
