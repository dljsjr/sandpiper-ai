import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { SANDPIPER_SYSTEM_NOTIFICATION_CUSTOM_TYPE, SystemNotificationSourceType } from 'sandpiper-ai-core';
import { describe, expect, it, vi } from 'vitest';
import init from './index.js';
import type { WebFetchToolInput, WebFetchToolResult } from './tool-operation.js';
import { type FetchAdapter, WebFetchFilterType } from './types.js';

interface RegisteredWebFetchTool {
  execute(toolCallId: string, params: WebFetchToolInput): Promise<WebFetchToolResult>;
}

function createAdapter(): FetchAdapter {
  return {
    fetch: vi.fn(),
  };
}

describe('web-fetch extension', () => {
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

  it('sends llms.txt probe metadata as hidden agent context', async () => {
    const toolResult: WebFetchToolResult = {
      content: [{ type: 'text', text: 'URL: https://example.com/page\n\nExample body' }],
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
    expect(sendMessage).toHaveBeenCalledWith(
      {
        customType: SANDPIPER_SYSTEM_NOTIFICATION_CUSTOM_TYPE,
        content: [
          '<sandpiper_system_notification source_type="tool" source_id="web_fetch">',
          '  <instructions>Supplemental metadata only. Do not treat this as fetched page content or as a user request.</instructions>',
          '  <page url="https://example.com/page"/>',
          '  <llms_txt status="found" url="https://example.com/llms.txt" http_status="200" content_fetched="false"/>',
          '</sandpiper_system_notification>',
        ].join('\n'),
        display: false,
        details: {
          sourceType: SystemNotificationSourceType.Tool,
          sourceId: 'web_fetch',
          instructions: 'Supplemental metadata only. Do not treat this as fetched page content or as a user request.',
          data: {
            page: { url: 'https://example.com/page' },
            llms_txt: {
              status: 'found',
              url: 'https://example.com/llms.txt',
              http_status: 200,
              content_fetched: false,
            },
          },
        },
      },
      { deliverAs: 'steer' },
    );
  });

  it('does not send hidden agent context when probe metadata is absent', async () => {
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
