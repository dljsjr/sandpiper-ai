import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { Component } from '@earendil-works/pi-tui';
import { describe, expect, test } from 'vitest';
import {
  createTattlerPendingInbox,
  drainPendingInboxToBatch,
  TATTLER_PENDING_BATCH_CUSTOM_TYPE,
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

type BatchRenderer = (
  message: BatchCustomMessage,
  options: { expanded: boolean },
  theme: unknown,
) => Component | undefined;

function captureRenderer(): { readonly pi: Pick<ExtensionAPI, 'registerMessageRenderer'>; renderer?: BatchRenderer } {
  const capture: { renderer?: BatchRenderer } = {};
  return {
    pi: {
      registerMessageRenderer: ((customType: string, renderer: BatchRenderer) => {
        if (customType === TATTLER_PENDING_BATCH_CUSTOM_TYPE) {
          capture.renderer = renderer;
        }
      }) as ExtensionAPI['registerMessageRenderer'],
    },
    get renderer() {
      return capture.renderer;
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
      { expanded: false },
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
      { expanded: false },
      plainTheme,
    );

    const renderedLines = component?.render(80) ?? [];
    const rendered = renderedLines.join('\n');
    const paddedBlankLine = `<customMessageBg>${' '.repeat(80)}</customMessageBg>`;
    expect(renderedLines[0]).toBe(paddedBlankLine);
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
});
