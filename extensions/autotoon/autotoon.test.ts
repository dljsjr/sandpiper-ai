import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { describe, expect, it, vi } from 'vitest';
import autotoon from './autotoon.js';
import { MIN_JSON_BYTES } from './core.js';

describe('autotoon Pi extension', () => {
  it('preserves read JSON content and metadata without returning a patch', async () => {
    const json = `${JSON.stringify(Array(50).fill({ id: 1, name: 'café', value: 42 }), null, 2).replaceAll('\n', '\r\n')}\r\n`;
    const event = {
      toolName: 'read',
      toolCallId: 'tc-read',
      input: { path: 'fixture.json' },
      content: [
        { type: 'text', text: json },
        { type: 'image', data: 'base64data', mimeType: 'image/png' },
      ],
      details: { truncation: { truncated: false } },
      structuredContent: { source: 'fixture.json' },
      usage: { input: 1, output: 2 },
      isError: false,
    };
    const original = structuredClone(event);
    let handlerResult: unknown = null;

    const mockPi = {
      on: vi.fn((_event: string, handler: (result: unknown) => void) => {
        handlerResult = handler(event);
      }),
    } as unknown as ExtensionAPI;

    autotoon(mockPi);

    expect(await handlerResult).toBeUndefined();
    expect(event).toEqual(original);
    expect(Buffer.from(event.content[0]!.text!)).toEqual(Buffer.from(json));
  });

  it('does not modify error results', async () => {
    let handlerCalled = false;
    let handlerResult: unknown = null;

    const mockPi = {
      on: vi.fn((_event: string, handler: (result: unknown) => void) => {
        handlerCalled = true;
        handlerResult = handler({
          toolName: 'bash',
          toolCallId: 'tc-1',
          input: { command: 'curl ...' },
          content: [{ type: 'text', text: '{"error": "not found"}' }],
          details: {},
          isError: true,
        });
      }),
    } as unknown as ExtensionAPI;

    autotoon(mockPi);

    expect(handlerCalled).toBe(true);
    const result = await handlerResult;
    expect(result).toBeUndefined();
  });

  it('converts JSON content blocks and leaves non-JSON blocks unchanged', async () => {
    const largeJson = JSON.stringify(Array(50).fill({ id: 1, name: 'test', value: 42 }));
    let handlerResult: unknown = null;

    const mockPi = {
      on: vi.fn((_event: string, handler: (result: unknown) => void) => {
        handlerResult = handler({
          toolName: 'bash',
          toolCallId: 'tc-2',
          input: { command: 'curl ...' },
          content: [
            { type: 'text', text: 'STDERR: some warning\n' },
            { type: 'text', text: largeJson },
          ],
          details: {},
          isError: false,
        });
      }),
    } as unknown as ExtensionAPI;

    autotoon(mockPi);

    const result = (await handlerResult) as { content: Array<{ text: string }> } | undefined;
    expect(result).toBeDefined();
    expect(result!.content).toBeDefined();
    expect(result!.content.length).toBeGreaterThanOrEqual(2);
    const firstBlock = result!.content.at(0);
    const secondBlock = result!.content.at(1);
    expect(firstBlock).toBeDefined();
    expect(secondBlock).toBeDefined();
    expect(firstBlock!.text).toBe('STDERR: some warning\n');
    expect(secondBlock!.text).toContain('[TOON]\n');
  });

  it('skips conversion when JSON is below size threshold', async () => {
    const smallJson = JSON.stringify({ key: 'value' });
    let handlerResult: unknown = null;

    const mockPi = {
      on: vi.fn((_event: string, handler: (result: unknown) => void) => {
        handlerResult = handler({
          toolName: 'bash',
          toolCallId: 'tc-3',
          input: { command: 'echo test' },
          content: [{ type: 'text', text: smallJson }],
          details: {},
          isError: false,
        });
      }),
    } as unknown as ExtensionAPI;

    autotoon(mockPi);

    const result = await handlerResult;
    expect(result).toBeUndefined();
  });

  it('handles mixed content types (text + image)', async () => {
    const largeJson = JSON.stringify(Array(50).fill({ id: 1, name: 'test' })).padEnd(MIN_JSON_BYTES + 1);
    let handlerResult: unknown = null;

    const mockPi = {
      on: vi.fn((_event: string, handler: (result: unknown) => void) => {
        handlerResult = handler({
          toolName: 'bash',
          toolCallId: 'tc-4',
          input: { command: 'curl ...' },
          content: [
            { type: 'text', text: largeJson },
            { type: 'image', data: 'base64data', mimeType: 'image/png' },
          ],
          details: {},
          isError: false,
        });
      }),
    } as unknown as ExtensionAPI;

    autotoon(mockPi);

    const result = (await handlerResult) as { content: Array<{ text: string; type?: string }> } | undefined;
    expect(result).toBeDefined();
    expect(result!.content).toBeDefined();
    expect(result!.content.length).toBeGreaterThanOrEqual(2);
    const textBlock = result!.content.at(0);
    const imageBlock = result!.content.at(1);
    expect(textBlock).toBeDefined();
    expect(imageBlock).toBeDefined();
    expect(textBlock!.text).toContain('[TOON]\n');
    expect(imageBlock!.type).toBe('image');
  });
  it('leaves results of nested tool calls unchanged, so codemode scripts get the JSON they expect', async () => {
    const largeJson = JSON.stringify(Array(50).fill({ id: 1, name: 'test', value: 42 }));
    let handlerResult: unknown = null;

    const mockPi = {
      on: vi.fn((_event: string, handler: (result: unknown) => void) => {
        handlerResult = handler({
          toolName: 'bash',
          toolCallId: 'tc-parent/1',
          parentToolCallId: 'tc-parent',
          input: { command: 'curl ...' },
          content: [{ type: 'text', text: largeJson }],
          details: {},
          isError: false,
        });
      }),
    } as unknown as ExtensionAPI;

    autotoon(mockPi);

    expect(await handlerResult).toBeUndefined();
  });

  it('keeps the structured result when it converts the text content', async () => {
    const records = Array(50).fill({ id: 1, name: 'test', value: 42 });
    let handlerResult: unknown = null;

    const mockPi = {
      on: vi.fn((_event: string, handler: (result: unknown) => void) => {
        handlerResult = handler({
          toolName: 'mcp__records__list',
          toolCallId: 'tc-3',
          input: {},
          content: [{ type: 'text', text: JSON.stringify(records) }],
          structuredContent: { records },
          details: {},
          isError: false,
        });
      }),
    } as unknown as ExtensionAPI;

    autotoon(mockPi);

    const result = (await handlerResult) as { content: unknown; structuredContent: unknown } | undefined;
    expect(result?.content).toBeDefined();
    expect(result?.structuredContent).toEqual({ records });
  });
});
