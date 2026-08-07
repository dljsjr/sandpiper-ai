import type { ExtensionAPI, ExtensionContext, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { describe, expect, test } from 'vitest';
import { registerTurnControlTool } from './turn-control-tool.js';

function captureTool(): ToolDefinition {
  let captured: ToolDefinition | undefined;
  const pi = {
    registerTool: ((tool: ToolDefinition) => {
      captured = tool;
    }) as unknown as ExtensionAPI['registerTool'],
  } as Pick<ExtensionAPI, 'registerTool'>;

  registerTurnControlTool(pi as ExtensionAPI);
  if (!captured) {
    throw new Error('done tool was not registered');
  }
  return captured;
}

describe('turn control tool', () => {
  test('registers a narrowly-guided done tool', () => {
    const tool = captureTool();

    expect(tool.name).toBe('done');
    expect(tool.description).toContain('without producing an assistant message');
    expect(tool.promptGuidelines?.join('\n')).toContain('Do not use done for normal user requests');
    expect(tool.promptGuidelines?.join('\n')).toContain('call it by itself');
    // Zero parameters -- nothing for strict-mode sampling to constrain.
    expect(tool.constrainedSampling).toBeUndefined();
  });

  test('terminates the current turn with provider-safe content and no rendering', async () => {
    const tool = captureTool();
    const result = await tool.execute('tool-call-id', {}, undefined, undefined, {} as ExtensionContext);

    expect(result).toEqual({
      content: [{ type: 'text', text: '(no response needed)' }],
      details: {},
      terminate: true,
    });
    expect(tool.renderCall?.({}, {} as never, {} as never).render(80)).toEqual([]);
    expect(tool.renderResult?.(result, {} as never, {} as never, {} as never).render(80)).toEqual([]);
  });
});
