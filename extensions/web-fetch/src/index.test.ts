import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { describe, expect, it, vi } from 'vitest';
import init from './index.js';
import type { WebFetchToolInput, WebFetchToolResult } from './tool-operation.js';
import { type FetchAdapter, WebFetchFilterType } from './types.js';

interface RegisteredWebFetchTool {
  readonly promptSnippet?: string;
  execute(toolCallId: string, params: WebFetchToolInput): Promise<WebFetchToolResult>;
}

function createAdapter(): FetchAdapter {
  return {
    fetch: vi.fn(),
  };
}

describe('web-fetch extension', () => {
  it('opts into the available-tools system prompt list', async () => {
    const pi = {
      registerTool: vi.fn(),
    } as unknown as ExtensionAPI;

    await init(pi, { adapter: createAdapter() });

    const registeredTool = vi.mocked(pi.registerTool).mock.calls[0]?.[0] as RegisteredWebFetchTool | undefined;
    expect(registeredTool?.promptSnippet).toBe('Fetch a web page and return clean markdown content');
  });

  it('registers both CSS selector and Markdown section filter schemas', async () => {
    const pi = {
      registerTool: vi.fn(),
    } as unknown as ExtensionAPI;

    await init(pi, { adapter: createAdapter() });

    const registeredTool = vi.mocked(pi.registerTool).mock.calls[0]?.[0];
    const schemaText = JSON.stringify(registeredTool?.parameters);
    expect(schemaText).toContain(WebFetchFilterType.CssSelector);
    expect(schemaText).toContain(WebFetchFilterType.MarkdownSection);
    expect(schemaText).toContain('heading');
  });

  it('prefers strict JSON-schema sampling for the filter anyOf union (0.84.0 #7328 pairing)', async () => {
    const pi = {
      registerTool: vi.fn(),
    } as unknown as ExtensionAPI;

    await init(pi, { adapter: createAdapter() });

    const registeredTool = vi.mocked(pi.registerTool).mock.calls[0]?.[0] as
      | { readonly constrainedSampling?: unknown }
      | undefined;
    expect(registeredTool?.constrainedSampling).toEqual({ type: 'json_schema', strict: 'prefer' });
  });

  it.each([
    ['css_selector filter arm', { type: WebFetchFilterType.CssSelector, selector: '.article' }],
    ['markdown_section filter arm', { type: WebFetchFilterType.MarkdownSection, heading: 'Usage', level: 2 }],
  ] as const)(
    'passes the %s through execute() unmangled (union-arm preservation regression, #7328)',
    async (_label, filter) => {
      const executeWebFetchTool = vi.fn(async () => ({
        content: [{ type: 'text' as const, text: 'ok' }],
        details: { url: 'https://example.com/page', title: 'Example' },
      }));
      let registeredTool: RegisteredWebFetchTool | undefined;
      const pi = {
        registerTool: vi.fn((tool: RegisteredWebFetchTool) => {
          registeredTool = tool;
        }),
      } as unknown as ExtensionAPI;

      await init(pi, { adapter: createAdapter(), executeWebFetchTool });
      await registeredTool?.execute('call-1', { url: 'https://example.com/page', filter });

      // The union arm's exact fields (including the 'type' discriminant) must reach our
      // execution layer unchanged -- not coerced, not stripped, not merged with the other arm's
      // shape. This is the class of bug #7328 fixed on Pi's side (nullable-union coercion
      // silently replacing an already-valid value); this test guards our own consumption of
      // whatever Pi hands us for this schema.
      expect(executeWebFetchTool).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ url: 'https://example.com/page', filter }),
      );
    },
  );

  it('returns the tool result directly without sending a system notification when llms.txt exists', async () => {
    const toolResult: WebFetchToolResult = {
      content: [
        {
          type: 'text',
          text: 'URL: https://example.com/page\n\nExample body\n\n---\n\n<additional_content>\n  <llms_txt\n    status="found"\n    url="https://example.com/llms.txt"\n    http_status="200"\n  />\n</additional_content>',
        },
      ],
      details: {
        url: 'https://example.com/page',
        title: 'Example title',
        llmsTxt: {
          checked: true,
          exists: true,
          status: 'found',
          url: 'https://example.com/llms.txt',
          checkedAt: '2026-05-13T00:00:00.000Z',
          statusCode: 200,
        },
      },
    };
    const executeWebFetchTool = vi.fn(async () => toolResult);
    const sendMessage = vi.fn();
    let registeredTool: RegisteredWebFetchTool | undefined;
    const pi = {
      registerTool: vi.fn((tool: RegisteredWebFetchTool) => {
        registeredTool = tool;
      }),
      sendMessage,
    } as unknown as ExtensionAPI;

    await init(pi, { adapter: createAdapter(), executeWebFetchTool });
    const output = await registeredTool?.execute('call-1', { url: 'https://example.com/page' });

    expect(output).toBe(toolResult);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('does not send a system notification when probe metadata is absent', async () => {
    const toolResult: WebFetchToolResult = {
      content: [{ type: 'text', text: 'URL: https://example.com/page\n\nExample body' }],
      details: {
        url: 'https://example.com/page',
        title: 'Example title',
      },
    };
    const sendMessage = vi.fn();
    let registeredTool: RegisteredWebFetchTool | undefined;
    const pi = {
      registerTool: vi.fn((tool: RegisteredWebFetchTool) => {
        registeredTool = tool;
      }),
      sendMessage,
    } as unknown as ExtensionAPI;

    await init(pi, { adapter: createAdapter(), executeWebFetchTool: vi.fn(async () => toolResult) });
    await registeredTool?.execute('call-1', { url: 'https://example.com/page' });

    expect(sendMessage).not.toHaveBeenCalled();
  });
});
