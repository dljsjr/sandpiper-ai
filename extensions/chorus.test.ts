import { createEventBus, type ExtensionAPI, type ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import { describe, expect, test, vi } from 'vitest';
import chorusExtension, { sendChorusMessageToChatOrQueue } from './chorus';
import { TATTLER_PENDING_BATCH_CUSTOM_TYPE, TATTLER_PENDING_BATCH_ENTRY_TYPE } from './tattler/tattler-inbox';
import { onTattlerPendingMessageQueueRequest, requestChorusRoomPost } from './tattler/tattler-pi-events';
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
  readonly constrainedSampling?: unknown;
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
  const handlers = new Map<string, (evt: unknown, ctx: unknown) => unknown>();
  const pi = {
    appendEntry: vi.fn(),
    events: createEventBus(),
    on: vi.fn((event: string, handler: (evt: unknown, ctx: unknown) => unknown) => {
      handlers.set(event, handler);
    }),
    registerCommand: vi.fn((name: string, command: RegisteredCommand) => {
      commands.set(name, command);
    }),
    registerEntryRenderer: vi.fn(),
    registerMessageRenderer: vi.fn(),
    registerTool: vi.fn((tool: RegisteredTool) => {
      tools.push(tool);
    }),
    sendMessage: vi.fn(),
    sendUserMessage: vi.fn(),
  } as unknown as ExtensionAPI;

  return { pi, commands, tools, handlers };
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

  test('prefers strict JSON-schema sampling for send_chorus_reply (six plain required strings)', () => {
    const { pi, tools } = fakePi();
    chorusExtension(pi);

    const tool = tools.find((registeredTool) => registeredTool.name === 'send_chorus_reply');

    expect(tool?.constrainedSampling).toEqual({ type: 'json_schema', strict: 'prefer' });
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

  test('routes model-invisible self-echo Chorus messages through appendEntry, never sendMessage', async () => {
    const { pi } = fakePi();
    onTattlerPendingMessageQueueRequest(pi, () => ({ queued: false }));

    await sendChorusMessageToChatOrQueue(
      pi,
      {
        roomId: roomId('chorus-dev'),
        from: 'Piper',
        message: 'my own post echoed back',
        postId: 'post-1' as TattlerMessageId,
        broker: { name: 'chorus:chorus-dev', shortId: 'chorus-dev', socketPath: '/tmp/chorus.sock' },
        self: true,
      },
      { triggerTurn: false, modelVisible: false },
    );

    expect(pi.sendMessage).not.toHaveBeenCalled();
    expect(pi.appendEntry).toHaveBeenCalledWith(
      TATTLER_PENDING_BATCH_ENTRY_TYPE,
      expect.objectContaining({
        kind: 'batch',
        messages: [
          expect.objectContaining({
            kind: 'chorus.room-message.v0',
            roomId: 'chorus-dev',
            from: 'Piper',
            message: 'my own post echoed back',
            postId: 'post-1',
            self: true,
            visible: true,
          }),
        ],
      }),
    );
  });
});

// AGENT-244: chorus registers its `pi.events`-backed room-post responder at extension-load
// time (inside the default export, not inside a `session_start` handler) and only tears it
// down on `session_shutdown`. Pi source (loader.js's `loadExtension`, resource-loader.js's
// `loadCurrentExtensionSet`) always re-invokes the extension factory on every session-
// replacement path this repo actually uses (reload reuses the same eventBus in place;
// new/resume/fork get an entirely fresh ResourceLoader+eventBus via `createRuntime` in pi's
// main.js) -- so the responder should come back regardless of which case fires. These two
// tests exercise that exact contract directly against chorus's own factory.
describe('Chorus event-responder lifecycle across session boundaries (AGENT-244)', () => {
  test('same-bus reload: room-post responder re-registers after session_shutdown clears it and the factory reruns on the same events bus', async () => {
    const { pi, handlers } = fakePi();
    chorusExtension(pi);

    await expect(
      requestChorusRoomPost(pi, { roomId: roomId('chorus-dev'), message: 'hi' }, { timeoutMs: 50 }),
    ).rejects.toThrow('No active Chorus broker');

    // /reload: session_shutdown clears listeners on this same eventBus, then pi's real reload
    // machinery re-invokes the extension factory against the SAME ResourceLoader/eventBus
    // (resource-loader.js never recreates `this.eventBus` inside `reload()`).
    handlers.get('session_shutdown')?.(undefined, undefined);
    chorusExtension(pi);

    await expect(
      requestChorusRoomPost(pi, { roomId: roomId('chorus-dev'), message: 'hi' }, { timeoutMs: 50 }),
    ).rejects.toThrow('No active Chorus broker');
  });

  test('fresh-bus /new: room-post responder registers on a brand-new events bus after the old one is torn down', async () => {
    const { pi: oldPi, handlers: oldHandlers } = fakePi();
    chorusExtension(oldPi);
    oldHandlers.get('session_shutdown')?.(undefined, undefined);

    // /new (and resume/fork): pi's `createRuntime` builds an entirely new ResourceLoader, so a
    // brand-new eventBus backs the next session, and the extension factory runs against it fresh.
    const { pi: newPi } = fakePi();
    chorusExtension(newPi);

    // The old, torn-down bus must not still answer -- nothing should have revived it.
    await expect(
      requestChorusRoomPost(oldPi, { roomId: roomId('chorus-dev'), message: 'hi' }, { timeoutMs: 50 }),
    ).rejects.toThrow('Timed out');

    // The new bus answers via the freshly re-registered responder.
    await expect(
      requestChorusRoomPost(newPi, { roomId: roomId('chorus-dev'), message: 'hi' }, { timeoutMs: 50 }),
    ).rejects.toThrow('No active Chorus broker');
  });
});
