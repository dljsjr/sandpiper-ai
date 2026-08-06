import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { Component } from '@earendil-works/pi-tui';
import { describe, expect, test } from 'vitest';
import {
  createTattlerPendingInbox,
  drainPendingInboxToBatch,
  TATTLER_PENDING_BATCH_CUSTOM_TYPE,
  TATTLER_PENDING_BATCH_ENTRY_TYPE,
  type TattlerPendingBatchDetails,
} from './tattler-inbox';
import { registerTattlerPendingBatchRenderer } from './tattler-inbox-renderer';
import { buildMessage, roomId, type TattlerAgentMessageV0, type TattlerMessageId } from './tattler-protocol';

interface BatchCustomMessage {
  readonly role: 'custom';
  readonly customType: string;
  readonly content: string;
  readonly display: boolean;
  readonly details?: TattlerPendingBatchDetails;
  readonly timestamp: number;
}

interface BatchCustomEntry {
  readonly type: 'custom';
  readonly customType: string;
  readonly data?: TattlerPendingBatchDetails;
}

type BatchRenderer = (
  message: BatchCustomMessage,
  options: { expanded: boolean; outputPad: number },
  theme: unknown,
) => Component | undefined;

type BatchEntryRenderer = (
  entry: BatchCustomEntry,
  options: { expanded: boolean },
  theme: unknown,
) => Component | undefined;

function captureRenderer(): {
  readonly pi: Pick<ExtensionAPI, 'registerEntryRenderer' | 'registerMessageRenderer'>;
  renderer?: BatchRenderer;
  entryRenderer?: BatchEntryRenderer;
} {
  const capture: { renderer?: BatchRenderer; entryRenderer?: BatchEntryRenderer } = {};
  return {
    pi: {
      registerMessageRenderer: ((customType: string, renderer: BatchRenderer) => {
        if (customType === TATTLER_PENDING_BATCH_CUSTOM_TYPE) {
          capture.renderer = renderer;
        }
      }) as ExtensionAPI['registerMessageRenderer'],
      registerEntryRenderer: ((customType: string, renderer: BatchEntryRenderer) => {
        if (customType === TATTLER_PENDING_BATCH_ENTRY_TYPE) {
          capture.entryRenderer = renderer;
        }
      }) as ExtensionAPI['registerEntryRenderer'],
    },
    get renderer() {
      return capture.renderer;
    },
    get entryRenderer() {
      return capture.entryRenderer;
    },
  };
}

const plainTheme = {
  fg: (_color: string, text: string) => text,
  bg: (color: string, text: string) => `<${color}>${text}</${color}>`,
  bold: (text: string) => text,
};

describe('Tattler pending batch renderer', () => {
  test('renders malformed batch details as empty instead of throwing or falling back to raw content', () => {
    const capture = captureRenderer();
    registerTattlerPendingBatchRenderer(capture.pi);

    const component = capture.renderer?.(
      {
        role: 'custom',
        customType: TATTLER_PENDING_BATCH_CUSTOM_TYPE,
        content: 'raw content must not render',
        display: true,
        details: { kind: 'batch' } as unknown as TattlerPendingBatchDetails,
        timestamp: Date.now(),
      },
      { expanded: false, outputPad: 1 },
      plainTheme,
    );

    expect(component?.render(80)).toEqual([]);
  });

  test('renders visible Chorus messages as separate blocks without hidden Tattler messages', () => {
    const inbox = createTattlerPendingInbox();
    const hiddenMessage: TattlerAgentMessageV0 = buildMessage('tattler.agent-message.v0', {
      id: 'hidden-1' as TattlerMessageId,
      from: 'Muninn',
      message: 'hidden coordination note',
    });
    inbox.enqueueAgentMessage(hiddenMessage);
    inbox.enqueue({
      kind: 'chorus.room-message.v0',
      id: 'delivery-1' as TattlerMessageId,
      roomId: roomId('chorus-dev'),
      from: 'Piper',
      message: 'visible room note',
      postId: 'post-1' as TattlerMessageId,
      broker: { name: 'chorus:chorus-dev', shortId: 'chorus-dev', socketPath: '/tmp/chorus.sock' },
      visible: true,
    });
    inbox.enqueue({
      kind: 'chorus.room-message.v0',
      id: 'delivery-2' as TattlerMessageId,
      roomId: roomId('chorus-dev'),
      from: 'Librarian',
      message: 'second visible note',
      postId: 'post-2' as TattlerMessageId,
      broker: { name: 'chorus:chorus-dev', shortId: 'chorus-dev', socketPath: '/tmp/chorus.sock' },
      visible: true,
    });
    const drain = drainPendingInboxToBatch(inbox);
    expect(drain?.message.display).toBe(true);

    const capture = captureRenderer();
    registerTattlerPendingBatchRenderer(capture.pi);
    const component = capture.renderer?.(
      {
        role: 'custom',
        customType: TATTLER_PENDING_BATCH_CUSTOM_TYPE,
        content: drain!.message.content,
        display: drain!.message.display,
        details: drain!.message.details,
        timestamp: Date.now(),
      },
      { expanded: false, outputPad: 1 },
      plainTheme,
    );

    const renderedLines = component?.render(80) ?? [];
    const rendered = renderedLines.join('\n');
    const paddedBlankLine = `<customMessageBg>${' '.repeat(80)}</customMessageBg>`;
    expect(renderedLines[0]).toBe(paddedBlankLine);
    expect(renderedLines[1]?.startsWith('<customMessageBg> [Piper] #chorus-dev')).toBe(true);
    expect(renderedLines[1]?.endsWith(' </customMessageBg>')).toBe(true);
    expect(renderedLines[2]?.startsWith('<customMessageBg> visible room note')).toBe(true);
    expect(renderedLines[2]?.endsWith(' </customMessageBg>')).toBe(true);
    expect(renderedLines[3]).toBe(paddedBlankLine);
    expect(renderedLines[4]).toBe('');
    expect(renderedLines[5]).toBe(paddedBlankLine);
    expect(renderedLines[8]).toBe(paddedBlankLine);
    expect(rendered).toContain('[Piper] #chorus-dev');
    expect(rendered).toContain('visible room note');
    expect(rendered).toContain('[Librarian] #chorus-dev');
    expect(rendered).toContain('second visible note');
    expect(rendered).not.toContain('hidden coordination note');
  });

  test('renders display-only entry batches identically to message batches (shared component)', () => {
    const details: TattlerPendingBatchDetails = {
      kind: 'batch',
      batchId: 'entry-batch-1',
      messages: [
        {
          kind: 'chorus.room-message.v0',
          id: 'delivery-1' as TattlerMessageId,
          roomId: roomId('chorus-dev'),
          from: 'Piper',
          message: 'self-echoed note',
          postId: 'post-1' as TattlerMessageId,
          broker: { name: 'chorus:chorus-dev', shortId: 'chorus-dev', socketPath: '/tmp/chorus.sock' },
          self: true,
          visible: true,
        },
      ],
    };

    const capture = captureRenderer();
    registerTattlerPendingBatchRenderer(capture.pi);

    const entryComponent = capture.entryRenderer?.(
      { type: 'custom', customType: TATTLER_PENDING_BATCH_ENTRY_TYPE, data: details },
      { expanded: false },
      plainTheme,
    );
    const messageComponent = capture.renderer?.(
      {
        role: 'custom',
        customType: TATTLER_PENDING_BATCH_CUSTOM_TYPE,
        content: '',
        display: true,
        details,
        timestamp: Date.now(),
      },
      // outputPad: 1 matches the entry renderer's DEFAULT_OUTPUT_PAD fallback (entries have no
      // outputPad in their options at all) -- otherwise this comparison wouldn't be apples-to-apples.
      { expanded: false, outputPad: 1 },
      plainTheme,
    );

    expect(entryComponent?.render(80)).toEqual(messageComponent?.render(80));
    expect(entryComponent?.render(80).join('\n')).toContain('self-echoed note');
  });

  test('honors outputPad for the message-renderer path (unavailable to the entry-renderer path)', () => {
    const details: TattlerPendingBatchDetails = {
      kind: 'batch',
      batchId: 'pad-check-1',
      messages: [
        {
          kind: 'chorus.room-message.v0',
          id: 'pad-1' as TattlerMessageId,
          roomId: roomId('chorus-dev'),
          from: 'Piper',
          message: 'padding check',
          postId: 'post-1' as TattlerMessageId,
          broker: { name: 'chorus:chorus-dev', shortId: 'chorus-dev', socketPath: '/tmp/chorus.sock' },
          visible: true,
        },
      ],
    };
    const asMessage = (outputPad: number) =>
      capture.renderer?.(
        {
          role: 'custom',
          customType: TATTLER_PENDING_BATCH_CUSTOM_TYPE,
          content: '',
          display: true,
          details,
          timestamp: Date.now(),
        },
        { expanded: false, outputPad },
        plainTheme,
      );

    const capture = captureRenderer();
    registerTattlerPendingBatchRenderer(capture.pi);

    const padded = asMessage(1)?.render(80) ?? [];
    const unpadded = asMessage(0)?.render(80) ?? [];

    // padContentLineToWidth prepends outputPad spaces before the badge/content text.
    expect(padded[1]?.startsWith('<customMessageBg> [Piper]')).toBe(true);
    expect(unpadded[1]?.startsWith('<customMessageBg>[Piper]')).toBe(true);
  });

  test('renders malformed entry data as empty instead of throwing', () => {
    const capture = captureRenderer();
    registerTattlerPendingBatchRenderer(capture.pi);

    const component = capture.entryRenderer?.(
      {
        type: 'custom',
        customType: TATTLER_PENDING_BATCH_ENTRY_TYPE,
        data: { kind: 'batch' } as unknown as TattlerPendingBatchDetails,
      },
      { expanded: false },
      plainTheme,
    );

    expect(component?.render(80)).toEqual([]);
  });
});
