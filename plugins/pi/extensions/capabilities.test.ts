import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';
import capabilitiesExtension from './capabilities.js';

function createExtensionCapture(): {
  readonly pi: Pick<ExtensionAPI, 'on' | 'registerTool'>;
  readonly events: string[];
  readonly tools: string[];
} {
  const events: string[] = [];
  const tools: string[] = [];

  return {
    pi: {
      on: ((event: string) => {
        events.push(event);
      }) as ExtensionAPI['on'],
      registerTool: ((tool: { readonly name: string }) => {
        tools.push(tool.name);
      }) as ExtensionAPI['registerTool'],
    },
    events,
    tools,
  };
}

describe('neutral capabilities extension entrypoint', () => {
  it('loads background process capabilities without Sandpiper identity hooks', () => {
    const { pi, events, tools } = createExtensionCapture();

    capabilitiesExtension(pi as ExtensionAPI);

    expect(tools).toEqual(['skill', 'done', 'start_background_process', 'check_background_process']);
    expect(events).toEqual(['turn_end', 'context', 'session_shutdown']);
  });
});
