import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { describe, expect, test } from 'vitest';
import { createTattlerPendingInbox } from './tattler-inbox';
import { registerTattlerPendingInboxHooks } from './tattler-inbox-hooks';
import { buildMessage } from './tattler-protocol';

type AnyHandler = (...args: readonly unknown[]) => unknown;

function captureEventHandlers(): { readonly pi: Pick<ExtensionAPI, 'on'>; readonly handlers: Map<string, AnyHandler> } {
  const handlers = new Map<string, AnyHandler>();
  return {
    pi: {
      on: ((event: string, handler: AnyHandler) => {
        handlers.set(event, handler);
      }) as ExtensionAPI['on'],
    },
    handlers,
  };
}

describe('Tattler pending inbox hooks', () => {
  test('drains pending inbox into one custom batch message before normal agent starts', async () => {
    const inbox = createTattlerPendingInbox();
    inbox.enqueueAgentMessage(buildMessage('tattler.agent-message.v0', { from: 'Muninn', message: 'review note' }));
    const { pi, handlers } = captureEventHandlers();

    registerTattlerPendingInboxHooks(pi as ExtensionAPI, inbox);

    const handler = handlers.get('before_agent_start');
    expect(handler).toBeDefined();

    const result = (await handler?.({ systemPrompt: 'base', systemPromptOptions: {} }, {})) as
      | { message?: { customType: string; content: string; display: boolean; details: unknown } }
      | undefined;

    expect(result?.message).toMatchObject({
      customType: 'tattler:pending-batch',
      display: false,
      details: { kind: 'batch', messages: [expect.objectContaining({ from: 'Muninn', message: 'review note' })] },
    });
    expect(result?.message?.content).toContain('<tattler_pending_message_batch');
    expect(result?.message?.content).toContain('<tattler_agent_message');
    expect(inbox.counts()).toEqual({ pending: 0, reserved: 0, handedToTurn: 1, total: 1 });

    const messageEnd = handlers.get('message_end');
    expect(messageEnd).toBeDefined();
    messageEnd?.({
      message: {
        role: 'custom',
        customType: result?.message?.customType,
        content: result?.message?.content,
        display: result?.message?.display,
        details: result?.message?.details,
      },
    });

    expect(inbox.counts()).toEqual({ pending: 0, reserved: 0, handedToTurn: 0, total: 0 });
  });
});
