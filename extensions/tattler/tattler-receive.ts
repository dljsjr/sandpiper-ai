import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
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
    exposure: 'deferred',
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
  // retry/compaction/follow-up). Messages still pending then would otherwise wait for the next
  // prompt, which may never come, so deliver them whether or not the model called tattler_receive.
  // After the user aborts a run, leave them for the next prompt unless tattler_receive asked.
  // Per Pi's docs, isIdle() is true here "unless another extension started a new run"; if not idle,
  // the before_agent_start drain hook (registerTattlerPendingInboxHooks) picks the batch up instead.
  pi.on('agent_settled', (event) => {
    const requested = receiveRequested;
    receiveRequested = false;
    if (event.aborted && !requested) {
      return;
    }

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
