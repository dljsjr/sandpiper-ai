import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { Component } from '@earendil-works/pi-tui';
import { Type } from 'typebox';

const emptyToolRenderComponent: Component = {
  render: () => [],
  invalidate: () => undefined,
};

export function registerTurnControlTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: 'done',
    label: 'Done',
    description:
      'End the current turn without producing an assistant message. Use only when the requested visible action is already complete and no prose response is needed.',
    promptSnippet: 'Silently finish the current turn after completed action when no assistant response is needed',
    promptGuidelines: [
      'Use done only after the requested visible action is complete or the user explicitly asked for no assistant response; in multi-agent rooms, this includes non-blocking messages that need no reply.',
      'Do not use done for normal user requests, errors, uncertainty, or when follow-up work remains.',
      'Do not call done together with other tools; call it by itself only, because it terminates the turn without an assistant message.',
    ],
    parameters: Type.Object({}),
    renderShell: 'self',
    renderCall: () => emptyToolRenderComponent,
    renderResult: () => emptyToolRenderComponent,
    async execute() {
      return {
        content: [{ type: 'text', text: '(no response needed)' }],
        details: {},
        terminate: true,
      };
    },
  });
}
