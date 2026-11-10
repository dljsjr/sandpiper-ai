import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { Component } from '@earendil-works/pi-tui';
import { Type } from 'typebox';
import { drainPendingInboxToBatch, type TattlerPendingInbox } from './tattler-inbox';

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

  // agent_settled fires once Pi will not continue running automatically (no pending
  // retry/compaction/follow-up) -- the precise signal tattler_receive needs, replacing the
  // old agent_end + 25ms isIdle() poll loop entirely. Per Pi's docs, isIdle() is true here
  // "unless another extension started a new run" -- keep the defensive check for that case;
  // if it's not idle, drop this attempt and let the existing before_agent_start drain hook
  // (registerTattlerPendingInboxHooks) pick the batch up on the next turn instead of retrying.
  pi.on('agent_settled', () => {
    if (!receiveRequested) {
      return;
    }

    receiveRequested = false;

    let idle = false;
    try {
      idle = idleProvider.isIdle();
    } catch {
      return;
    }

    if (!idle) {
      return;
    }

    const drain = drainPendingInboxToBatch(inbox);
    if (!drain) {
      return;
    }

    try {
      pi.sendMessage(drain.message, { triggerTurn: true, deliverAs: 'steer' });
      drain.markHandedToTurn();
    } catch {
      drain.release();
    }
  });
}

export type TattlerReceiveContext = Pick<ExtensionContext, 'isIdle'>;
