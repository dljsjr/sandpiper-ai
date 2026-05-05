import { describe, expect, it, vi } from 'vitest';
import { executeWebFetchTool, formatWebFetchResult } from './tool-operation.js';
import type { FetchAdapter, WebFetchResult } from './types.js';

function createResult(overrides: Partial<WebFetchResult> = {}): WebFetchResult {
  return {
    url: 'https://example.com/final',
    title: 'Example title',
    excerpt: 'Example excerpt',
    byline: 'Example author',
    siteName: 'Example site',
    content: 'Example body',
    ...overrides,
  };
}

function createAdapter(): FetchAdapter {
  return {
    fetch: vi.fn(async () => ({
      url: 'https://example.com/final',
      statusCode: 200,
      contentType: 'text/html',
      html: '<h1>Example</h1>',
    })),
  };
}

describe('formatWebFetchResult', () => {
  it('renders metadata and content', () => {
    expect(formatWebFetchResult(createResult())).toBe(
      'URL: https://example.com/final\n\n# Example title\n\n*By Example author*\n\n*Source: Example site*\n\n> Example excerpt\n\n---\n\nExample body',
    );
  });

  it('omits empty metadata', () => {
    expect(formatWebFetchResult(createResult({ title: '', excerpt: '', byline: '', siteName: '' }))).toBe(
      'URL: https://example.com/final\n\nExample body',
    );
  });

  it('renders discovered links when present', () => {
    const output = formatWebFetchResult(createResult({ links: [{ text: 'Docs', href: 'https://example.com/docs' }] }));

    expect(output).toContain('## Links found on page');
    expect(output).toContain('- [Docs](https://example.com/docs)');
  });
});

describe('executeWebFetchTool', () => {
  it('fetches and formats a page', async () => {
    const result = createResult({ title: 'Fetched title' });
    const fetchAndExtract = vi.fn(async () => result);

    const output = await executeWebFetchTool(
      createAdapter(),
      { url: 'https://example.com', followLinks: true },
      {
        fetchAndExtract,
      },
    );

    expect(fetchAndExtract).toHaveBeenCalledWith(expect.anything(), 'https://example.com', { followLinks: true });
    expect(output).toEqual({
      content: [{ type: 'text', text: formatWebFetchResult(result) }],
      details: { url: 'https://example.com/final', title: 'Fetched title' },
    });
  });

  it('returns fetch failures as text results with error details', async () => {
    const fetchAndExtract = vi.fn(async () => {
      throw new Error('network down');
    });

    const output = await executeWebFetchTool(createAdapter(), { url: 'https://example.com' }, { fetchAndExtract });

    expect(output).toEqual({
      content: [{ type: 'text', text: 'Failed to fetch https://example.com: network down' }],
      details: { url: 'https://example.com', error: 'network down' },
    });
  });
});
