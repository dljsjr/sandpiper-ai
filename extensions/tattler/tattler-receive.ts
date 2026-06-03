import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { Component } from '@earendil-works/pi-tui';
import { Type } from 'typebox';
import { drainPendingInboxToBatch, type TattlerPendingInbox } from './tattler-inbox';

const TATTLER_RECEIVE_IDLE_RETRY_MS = 25;

const emptyToolRenderComponent: Component = {
  render: () => [],
  invalidate: () => undefined,
};

interface TattlerReceiveIdleProvider {
  isIdle(): boolean;
}

export function registerTattlerReceiveTool(
  pi: Pick<ExtensionAPI, 'on' | 'registerTool' | 'sendMessage'>,
  inbox: TattlerPendingInbox,
  idleProvider: TattlerReceiveIdleProvider,
): void {
  let receiveRequested = false;
  let receiveScheduled = false;

  pi.registerTool({
    name: 'tattler_receive',
    label: 'Receive Tattler Messages',
    description: 'Yield the current turn so pending Tattler/Chorus messages can be delivered as a batch.',
    promptSnippet: 'Cooperatively receive pending Tattler/Chorus messages when they may affect current work.',
    promptGuidelines: [
      'Call tattler_receive only when pending Tattler/Chorus messages may affect the current work; do not use it as an acknowledgement.',
      'Call tattler_receive by itself, not alongside other tools; it terminates the current turn so pending messages can be delivered cleanly.',
    ],
    parameters: Type.Object({}),
    executionMode: 'sequential',
    renderShell: 'self',
    renderCall: () => emptyToolRenderComponent,
    renderResult: () => emptyToolRenderComponent,
    async execute() {
      receiveRequested = true;
      return {
        content: [{ type: 'text', text: '(pending Tattler messages will be delivered after this turn)' }],
        details: {},
        terminate: true,
      };
    },
  });

  pi.on('agent_end', () => {
    if (!receiveRequested || receiveScheduled) {
      return;
    }

    receiveRequested = false;
    receiveScheduled = true;
    setTimeout(flushWhenIdle, 0);
  });

  function flushWhenIdle(): void {
    let idle = false;
    try {
      idle = idleProvider.isIdle();
    } catch {
      receiveScheduled = false;
      return;
    }

    if (!idle) {
      setTimeout(flushWhenIdle, TATTLER_RECEIVE_IDLE_RETRY_MS);
      return;
    }

    const drain = drainPendingInboxToBatch(inbox);
    if (!drain) {
      receiveScheduled = false;
      return;
    }

    try {
      pi.sendMessage(drain.message, { triggerTurn: true, deliverAs: 'steer' });
      drain.markHandedToTurn();
    } catch {
      drain.release();
    } finally {
      receiveScheduled = false;
    }
  }
}

export type TattlerReceiveContext = Pick<ExtensionContext, 'isIdle'>;
