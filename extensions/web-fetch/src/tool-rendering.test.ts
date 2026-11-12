import { describe, expect, it } from 'vitest';
import type { WebFetchToolResult } from './tool-operation.js';
import { formatWebFetchRenderCall, formatWebFetchRenderResult } from './tool-rendering.js';

const theme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => `**${text}**`,
};

function createResult(overrides: Partial<WebFetchToolResult> = {}): WebFetchToolResult {
  return {
    content: [
      {
        type: 'text',
        text: 'URL: https://example.com/page\n\n# Example title\n\nExample body\n\nMore details',
      },
    ],
    details: {
      url: 'https://example.com/page',
      title: 'Example title',
    },
    ...overrides,
  };
}

describe('web-fetch tool rendering', () => {
  it('renders a compact tool call with the target URL', () => {
    expect(formatWebFetchRenderCall({ url: 'https://example.com/page' }, theme)).toBe(
      '**web_fetch** https://example.com/page',
    );
  });

  it('includes follow-links mode in the tool call when enabled', () => {
    expect(formatWebFetchRenderCall({ url: 'https://example.com/page', followLinks: true }, theme)).toBe(
      '**web_fetch** https://example.com/page (follow links)',
    );
  });

  it('includes render mode in the tool call when enabled', () => {
    expect(formatWebFetchRenderCall({ url: 'https://example.com/app', render: true }, theme)).toBe(
      '**web_fetch** https://example.com/app (rendered)',
    );
  });

  it('collapses fetched markdown by default', () => {
    expect(
      formatWebFetchRenderResult(createResult(), { expanded: false, isPartial: false }, theme, 'Ctrl+O to expand'),
    ).toBe('\nFetched Example title (7 lines, Ctrl+O to expand)');
  });

  it('renders the full markdown result when expanded', () => {
    expect(
      formatWebFetchRenderResult(createResult(), { expanded: true, isPartial: false }, theme, 'Ctrl+O to expand'),
    ).toBe('\nURL: https://example.com/page\n\n# Example title\n\nExample body\n\nMore details');
  });

  it('does not expose llms.txt metadata in the collapsed TUI summary', () => {
    const result = createResult({
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
    });

    expect(
      formatWebFetchRenderResult(result, { expanded: false, isPartial: false }, theme, 'Ctrl+O to expand'),
    ).not.toContain('llms');
  });
});
