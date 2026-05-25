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

function fakePi(overrides: { readonly sendMessage?: (message: unknown, options: unknown) => void } = {}) {
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
      overrides.sendMessage?.(message, options);
    }) as ExtensionAPI['sendMessage'],
  };

  return { pi, handlers, tools, sentMessages };
}

async function callTattlerReceive(tool: RegisteredTool | undefined): Promise<unknown> {
  return await tool?.execute(
    'tool-call',
    {},
    new AbortController().signal,
    () => {
      // no-op update callback
    },
    {},
  );
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

      const result = await callTattlerReceive(tools.get('tattler_receive'));

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

  test('does not start a synthetic turn when no pending messages exist', async () => {
    vi.useFakeTimers();
    try {
      const inbox = createTattlerPendingInbox();
      const { pi, handlers, tools, sentMessages } = fakePi();

      registerTattlerReceiveTool(pi, inbox, { isIdle: () => true });
      await callTattlerReceive(tools.get('tattler_receive'));
      handlers.get('agent_end')?.({ messages: [] });
      await vi.advanceTimersByTimeAsync(0);

      expect(sentMessages).toHaveLength(0);
      expect(inbox.counts()).toEqual({ pending: 0, reserved: 0, handedToTurn: 0, total: 0 });
    } finally {
      vi.useRealTimers();
    }
  });

  test('releases the reserved batch if direct synthetic turn handoff throws', async () => {
    vi.useFakeTimers();
    try {
      const inbox = createTattlerPendingInbox();
      inbox.enqueueAgentMessage(buildMessage('tattler.agent-message.v0', { from: 'Piper', message: 'retry later' }));
      const { pi, handlers, tools } = fakePi({
        sendMessage: () => {
          throw new Error('handoff failed');
        },
      });

      registerTattlerReceiveTool(pi, inbox, { isIdle: () => true });
      await callTattlerReceive(tools.get('tattler_receive'));
      handlers.get('agent_end')?.({ messages: [] });
      await vi.advanceTimersByTimeAsync(0);

      expect(inbox.counts()).toEqual({ pending: 1, reserved: 0, handedToTurn: 0, total: 1 });
    } finally {
      vi.useRealTimers();
    }
  });
});
