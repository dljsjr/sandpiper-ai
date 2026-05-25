import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { describe, expect, test, vi } from 'vitest';
import { createTattlerPendingInbox } from './tattler-inbox';
import { buildMessage } from './tattler-protocol';
import { registerTattlerReceiveTool } from './tattler-receive';

type AnyHandler = (...args: readonly unknown[]) => unknown;

type RegisteredTool = {
  readonly name: string;
  readonly execute: (...args: readonly unknown[]) => Promise<{
    readonly content: readonly { readonly type: 'text'; readonly text: string }[];
    readonly terminate?: boolean;
  }>;
};

function fakePi() {
  const handlers = new Map<string, AnyHandler>();
  const tools = new Map<string, RegisteredTool>();
  const sentMessages: Array<{ readonly message: unknown; readonly options: unknown }> = [];
  const pi = {
    on: ((event: string, handler: AnyHandler) => {
      handlers.set(event, handler);
    }) as ExtensionAPI['on'],
    registerTool: ((tool: RegisteredTool) => {
      tools.set(tool.name, tool);
    }) as ExtensionAPI['registerTool'],
    sendMessage: ((message: unknown, options: unknown) => {
      sentMessages.push({ message, options });
    }) as ExtensionAPI['sendMessage'],
  };

  return { pi, handlers, tools, sentMessages };
}

describe('tattler_receive tool', () => {
  test('terminates the current turn and starts a direct pending batch turn after idle', async () => {
    vi.useFakeTimers();
    try {
      const inbox = createTattlerPendingInbox();
      inbox.enqueueAgentMessage(buildMessage('tattler.agent-message.v0', { from: 'Piper', message: 'urgent note' }));
      const { pi, handlers, tools, sentMessages } = fakePi();
      let idle = false;

      registerTattlerReceiveTool(pi, inbox, { isIdle: () => idle });

      const result = await tools.get('tattler_receive')?.execute(
        'tool-call',
        {},
        new AbortController().signal,
        () => {
          // no-op update callback
        },
        {},
      );

      expect(result).toMatchObject({ terminate: true });
      expect(sentMessages).toHaveLength(0);

      handlers.get('agent_end')?.({ messages: [] });
      await vi.advanceTimersByTimeAsync(25);
      expect(sentMessages).toHaveLength(0);

      idle = true;
      await vi.advanceTimersByTimeAsync(25);

      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]?.options).toEqual({ triggerTurn: true, deliverAs: 'steer' });
      expect(sentMessages[0]?.message).toMatchObject({
        customType: 'tattler:pending-batch',
        content: expect.stringContaining('urgent note'),
      });
      expect(inbox.counts()).toEqual({ pending: 0, reserved: 0, handedToTurn: 1, total: 1 });
    } finally {
      vi.useRealTimers();
    }
  });
});
