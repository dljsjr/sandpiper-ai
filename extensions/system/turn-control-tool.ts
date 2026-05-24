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
      'Use done only when the requested action has already been completed through another tool, or when the user explicitly asked for no assistant response.',
      'Use done after a successful tool-mediated reply, notification, or acknowledgement when adding prose would be redundant noise.',
      'For visible multi-agent room messages, use done instead of a courtesy acknowledgement when you are not addressed, have no new information, and silence will not block progress.',
      'Do not use done for normal user requests, unanswered questions, errors, uncertainty, or when follow-up work remains.',
      'Do not call done together with other tools in the same assistant message; call it by itself only when the turn is complete.',
    ],
    parameters: Type.Object({}),
    renderShell: 'self',
    renderCall: () => emptyToolRenderComponent,
    renderResult: () => emptyToolRenderComponent,
    async execute() {
      return {
        content: [],
        details: {},
        terminate: true,
      };
    },
  });
}
