import { createEventBus, type ExtensionAPI, type ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import { describe, expect, test, vi } from 'vitest';
import chorusExtension, { sendChorusMessageToChatOrQueue, sendChorusSelfMessageToChatWhenIdle } from './chorus';
import { TATTLER_PENDING_BATCH_CUSTOM_TYPE } from './tattler/tattler-inbox';
import { onTattlerPendingMessageQueueRequest } from './tattler/tattler-pi-events';
import { roomId, type TattlerMessageId } from './tattler/tattler-protocol';

type RegisteredCommand = {
  readonly description?: string;
  readonly handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
};

type ToolRenderTheme = {
  fg: (color: 'accent' | 'dim' | 'muted' | 'success', text: string) => string;
  bg: (color: 'customMessageBg' | 'toolSuccessBg', text: string) => string;
  bold: (text: string) => string;
};

type RegisteredTool = {
  readonly name: string;
  readonly promptGuidelines?: readonly string[];
  readonly parameters?: {
    readonly properties?: {
      readonly message?: {
        readonly description?: string;
      };
    };
  };
  readonly renderResult?: (
    result: { readonly content: Array<{ readonly type: 'text'; readonly text: string }>; readonly details?: unknown },
    options: { readonly expanded: boolean; readonly isPartial: boolean },
    theme: ToolRenderTheme,
    context: unknown,
  ) => { render(width: number): string[] };
};

const markerTheme: ToolRenderTheme = {
  fg: (color, text) => `<fg:${color}>${text}</fg:${color}>`,
  bg: (color, text) => `<bg:${color}>${text}</bg:${color}>`,
  bold: (text) => `<bold>${text}</bold>`,
};

function fakePi() {
  const commands = new Map<string, RegisteredCommand>();
  const tools: RegisteredTool[] = [];
  const pi = {
    events: createEventBus(),
    on: vi.fn(),
    registerCommand: vi.fn((name: string, command: RegisteredCommand) => {
      commands.set(name, command);
    }),
    registerMessageRenderer: vi.fn(),
    registerTool: vi.fn((tool: RegisteredTool) => {
      tools.push(tool);
    }),
    sendMessage: vi.fn(),
    sendUserMessage: vi.fn(),
  } as unknown as ExtensionAPI;

  return { pi, commands, tools };
}

describe('Chorus extension commands', () => {
  test('registers reply tool guidance without duplicating the message voice contract', () => {
    const { pi, tools } = fakePi();
    chorusExtension(pi);

    const tool = tools.find((registeredTool) => registeredTool.name === 'send_chorus_reply');

    const guidelines = tool?.promptGuidelines?.join('\n') ?? '';
    expect(guidelines).toContain('Use send_chorus_reply only when a visible Chorus room message warrants');
    expect(guidelines).toContain('direct Tattler DM');
    expect(guidelines).toContain('Use done if no reply is needed and no other work remains');
    expect(guidelines).not.toContain('own SELF/identity voice');
    expect(tool?.parameters?.properties?.message?.description).toContain('SELF/identity voice');
  });

  test('renders successful replies as local sent receipts', () => {
    const { pi, tools } = fakePi();
    chorusExtension(pi);

    const tool = tools.find((registeredTool) => registeredTool.name === 'send_chorus_reply');
    const component = tool?.renderResult?.(
      {
        content: [{ type: 'text', text: 'Chorus reply sent. Do not summarize this tool result.' }],
        details: {
          kind: 'remote-delivery',
          messageIdAck: 'reply-1',
          sentMessage: {
            roomId: roomId('chorus-dev'),
            from: 'Piper',
            message: 'local reply',
            postId: 'reply-1' as TattlerMessageId,
            broker: { name: 'chorus:chorus-dev', shortId: 'chorus-dev', socketPath: '/tmp/chorus.sock' },
            self: true,
            status: 'sent',
          },
        },
      },
      { expanded: false, isPartial: false },
      markerTheme,
      {},
    );

    const rendered = component?.render(80).join('\n');
    expect(rendered).toContain('<fg:success>[Piper]</fg:success>');
    expect(rendered).toContain('<fg:dim> sent</fg:dim>');
    expect(rendered).toContain('local reply');
    expect(rendered).toContain('<bg:toolSuccessBg>');
  });

  test('renders older successful reply results as empty components', () => {
    const { pi, tools } = fakePi();
    chorusExtension(pi);

    const tool = tools.find((registeredTool) => registeredTool.name === 'send_chorus_reply');
    const component = tool?.renderResult?.(
      {
        content: [{ type: 'text', text: 'Chorus reply sent. Do not summarize this tool result.' }],
        details: { kind: 'remote-delivery', messageIdAck: 'reply-1' },
      },
      { expanded: false, isPartial: false },
      markerTheme,
      {},
    );

    expect(component?.render(80)).toEqual([]);
  });

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

  test('queues model-visible Chorus messages through Tattler when the agent is busy', async () => {
    const { pi } = fakePi();
    const seenMessages: unknown[] = [];
    onTattlerPendingMessageQueueRequest(pi, (message) => {
      seenMessages.push(message);
      return { queued: true, accepted: true, key: 'chorus.room-message.v0:chorus-dev:post-1' };
    });

    await sendChorusMessageToChatOrQueue(
      pi,
      {
        roomId: roomId('chorus-dev'),
        from: 'Piper',
        message: 'busy-room note',
        postId: 'post-1' as TattlerMessageId,
        broker: { name: 'chorus:chorus-dev', shortId: 'chorus-dev', socketPath: '/tmp/chorus.sock' },
      },
      { triggerTurn: true, modelVisible: true },
    );

    expect(pi.sendMessage).not.toHaveBeenCalled();
    expect(seenMessages).toEqual([
      expect.objectContaining({
        kind: 'chorus.room-message.v0',
        roomId: 'chorus-dev',
        from: 'Piper',
        message: 'busy-room note',
        postId: 'post-1',
        visible: true,
      }),
    ]);
  });

  test('emits model-visible idle Chorus messages as one-element Tattler batches', async () => {
    const { pi } = fakePi();
    onTattlerPendingMessageQueueRequest(pi, () => ({ queued: false }));

    await sendChorusMessageToChatOrQueue(
      pi,
      {
        roomId: roomId('chorus-dev'),
        from: 'Piper',
        message: 'idle-room note',
        postId: 'post-1' as TattlerMessageId,
        broker: { name: 'chorus:chorus-dev', shortId: 'chorus-dev', socketPath: '/tmp/chorus.sock' },
      },
      { triggerTurn: true, modelVisible: true },
    );

    expect(pi.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        customType: TATTLER_PENDING_BATCH_CUSTOM_TYPE,
        content: expect.stringContaining('pending="1"'),
        display: true,
        details: expect.objectContaining({
          kind: 'batch',
          messages: [
            expect.objectContaining({
              kind: 'chorus.room-message.v0',
              roomId: 'chorus-dev',
              from: 'Piper',
              message: 'idle-room note',
              postId: 'post-1',
              visible: true,
            }),
          ],
        }),
      }),
      { triggerTurn: true, deliverAs: 'steer' },
    );
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
          customType: TATTLER_PENDING_BATCH_CUSTOM_TYPE,
          content: '',
          display: true,
          details: expect.objectContaining({
            kind: 'batch',
            messages: [expect.objectContaining({ from: 'Piper', message: 'local reply', self: true, visible: true })],
          }),
        }),
        { triggerTurn: false, deliverAs: 'steer' },
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
