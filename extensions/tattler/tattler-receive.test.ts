import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { describe, expect, test } from 'vitest';
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
  test('terminates the current turn and delivers the pending batch when agent_settled fires idle', async () => {
    const inbox = createTattlerPendingInbox();
    inbox.enqueueAgentMessage(buildMessage('tattler.agent-message.v0', { from: 'Piper', message: 'urgent note' }));
    const { pi, handlers, tools, sentMessages } = fakePi();

    registerTattlerReceiveTool(pi, inbox, { isIdle: () => true });

    const result = await callTattlerReceive(tools.get('tattler_receive'));

    expect(result).toMatchObject({ terminate: true });
    expect(sentMessages).toHaveLength(0);

    handlers.get('agent_settled')?.({});

    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0]?.options).toEqual({ triggerTurn: true, deliverAs: 'steer' });
    expect(sentMessages[0]?.message).toMatchObject({
      customType: 'tattler:pending-batch',
      content: expect.stringContaining('urgent note'),
    });
    expect(inbox.counts()).toEqual({ pending: 0, reserved: 0, handedToTurn: 1, total: 1 });
  });

  test('does not deliver when agent_settled fires while not idle, leaving the batch for before_agent_start to pick up', async () => {
    const inbox = createTattlerPendingInbox();
    inbox.enqueueAgentMessage(buildMessage('tattler.agent-message.v0', { from: 'Piper', message: 'urgent note' }));
    const { pi, handlers, tools, sentMessages } = fakePi();

    registerTattlerReceiveTool(pi, inbox, { isIdle: () => false });

    await callTattlerReceive(tools.get('tattler_receive'));

    handlers.get('agent_settled')?.({});

    expect(sentMessages).toHaveLength(0);
    // Still pending -- not lost, not marked handed-to-turn; the existing before_agent_start
    // drain hook (registerTattlerPendingInboxHooks) will pick it up on the next turn.
    expect(inbox.counts()).toEqual({ pending: 1, reserved: 0, handedToTurn: 0, total: 1 });
  });

  test('does not fire again on a second agent_settled without a new tattler_receive call', async () => {
    const inbox = createTattlerPendingInbox();
    inbox.enqueueAgentMessage(buildMessage('tattler.agent-message.v0', { from: 'Piper', message: 'urgent note' }));
    const { pi, handlers, tools, sentMessages } = fakePi();

    registerTattlerReceiveTool(pi, inbox, { isIdle: () => true });
    await callTattlerReceive(tools.get('tattler_receive'));

    handlers.get('agent_settled')?.({});
    handlers.get('agent_settled')?.({});

    expect(sentMessages).toHaveLength(1);
  });

  test('does not start a synthetic turn when no pending messages exist', async () => {
    const inbox = createTattlerPendingInbox();
    const { pi, handlers, tools, sentMessages } = fakePi();

    registerTattlerReceiveTool(pi, inbox, { isIdle: () => true });
    await callTattlerReceive(tools.get('tattler_receive'));
    handlers.get('agent_settled')?.({});

    expect(sentMessages).toHaveLength(0);
    expect(inbox.counts()).toEqual({ pending: 0, reserved: 0, handedToTurn: 0, total: 0 });
  });

  test('releases the reserved batch if direct synthetic turn handoff throws', async () => {
    const inbox = createTattlerPendingInbox();
    inbox.enqueueAgentMessage(buildMessage('tattler.agent-message.v0', { from: 'Piper', message: 'retry later' }));
    const { pi, handlers, tools } = fakePi({
      sendMessage: () => {
        throw new Error('handoff failed');
      },
    });

    registerTattlerReceiveTool(pi, inbox, { isIdle: () => true });
    await callTattlerReceive(tools.get('tattler_receive'));
    handlers.get('agent_settled')?.({});

    expect(inbox.counts()).toEqual({ pending: 1, reserved: 0, handedToTurn: 0, total: 1 });
  });

  test('does not throw when isIdle() itself throws, and does not deliver', async () => {
    const inbox = createTattlerPendingInbox();
    inbox.enqueueAgentMessage(buildMessage('tattler.agent-message.v0', { from: 'Piper', message: 'urgent note' }));
    const { pi, handlers, tools, sentMessages } = fakePi();

    registerTattlerReceiveTool(pi, inbox, {
      isIdle: () => {
        throw new Error('context unavailable');
      },
    });
    await callTattlerReceive(tools.get('tattler_receive'));

    expect(() => handlers.get('agent_settled')?.({})).not.toThrow();
    expect(sentMessages).toHaveLength(0);
    expect(inbox.counts()).toEqual({ pending: 1, reserved: 0, handedToTurn: 0, total: 1 });
  });
});
