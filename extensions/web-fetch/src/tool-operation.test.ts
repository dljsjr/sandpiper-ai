import { describe, expect, it, vi } from 'vitest';
import { executeWebFetchTool, formatWebFetchResult } from './tool-operation.js';
import {
  type FetchAdapter,
  type LlmsTxtProbeResult,
  type WebFetchFilterSpec,
  WebFetchFilterType,
  type WebFetchResult,
} from './types.js';

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

  it('appends llms.txt metadata block when the probe found llms.txt', () => {
    const llmsTxt: LlmsTxtProbeResult = {
      checked: true,
      exists: true,
      status: 'found',
      url: 'https://example.com/llms.txt',
      checkedAt: '2026-05-13T00:00:00.000Z',
      statusCode: 200,
    };
    const output = formatWebFetchResult(createResult({ llmsTxt }));

    expect(output).toContain('<additional_content>');
    expect(output).toContain('status="found"');
    expect(output).toContain('url="https://example.com/llms.txt"');
    expect(output).toContain('http_status="200"');
  });

  it('omits the llms.txt metadata block when llms.txt is missing', () => {
    const llmsTxt: LlmsTxtProbeResult = {
      checked: true,
      exists: false,
      status: 'missing',
      url: 'https://example.com/llms.txt',
      checkedAt: '2026-05-13T00:00:00.000Z',
      statusCode: 404,
    };
    const output = formatWebFetchResult(createResult({ llmsTxt }));

    expect(output).not.toContain('<additional_content>');
    expect(output).not.toContain('llms.txt');
  });

  it('omits the llms.txt metadata block when the probe was indeterminate', () => {
    const llmsTxt: LlmsTxtProbeResult = {
      checked: true,
      exists: null,
      status: 'unknown',
      url: 'https://example.com/llms.txt',
      checkedAt: '2026-05-13T00:00:00.000Z',
      reason: 'unexpected-status',
    };
    const output = formatWebFetchResult(createResult({ llmsTxt }));

    expect(output).not.toContain('<additional_content>');
  });

  it('omits the llms.txt metadata block when no probe was attempted', () => {
    const output = formatWebFetchResult(createResult());

    expect(output).not.toContain('<additional_content>');
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

    expect(fetchAndExtract).toHaveBeenCalledWith(expect.anything(), 'https://example.com', {
      filter: undefined,
      followLinks: true,
    });
    expect(output).toEqual({
      content: [{ type: 'text', text: formatWebFetchResult(result) }],
      details: { url: 'https://example.com/final', title: 'Fetched title' },
    });
  });

  it('passes filter specs to the extraction pipeline', async () => {
    const result = createResult({ title: 'Filtered title' });
    const fetchAndExtract = vi.fn(async () => result);
    const filter: WebFetchFilterSpec = { type: WebFetchFilterType.CssSelector, selector: '#api' };

    await executeWebFetchTool(createAdapter(), { url: 'https://example.com', filter }, { fetchAndExtract });

    expect(fetchAndExtract).toHaveBeenCalledWith(expect.anything(), 'https://example.com', {
      filter,
      followLinks: undefined,
    });
  });

  it('includes llms.txt probe metadata in tool details and visible content when llms.txt exists', async () => {
    const llmsTxt: LlmsTxtProbeResult = {
      checked: true,
      exists: true,
      status: 'found',
      url: 'https://example.com/llms.txt',
      checkedAt: '2026-05-13T00:00:00.000Z',
      statusCode: 200,
    };
    const result = createResult({ llmsTxt });
    const fetchAndExtract = vi.fn(async () => result);

    const output = await executeWebFetchTool(createAdapter(), { url: 'https://example.com' }, { fetchAndExtract });

    expect(output.content[0]?.text).toBe(formatWebFetchResult(result));
    expect(output.content[0]?.text).toContain('<additional_content>');
    expect(output.content[0]?.text).toContain('status="found"');
    expect(output.details).toEqual({
      url: 'https://example.com/final',
      title: 'Example title',
      llmsTxt,
    });
  });

  it('keeps llms.txt probe metadata in details but out of visible content when llms.txt is missing', async () => {
    const llmsTxt: LlmsTxtProbeResult = {
      checked: true,
      exists: false,
      status: 'missing',
      url: 'https://example.com/llms.txt',
      checkedAt: '2026-05-13T00:00:00.000Z',
      statusCode: 404,
    };
    const result = createResult({ llmsTxt });
    const fetchAndExtract = vi.fn(async () => result);

    const output = await executeWebFetchTool(createAdapter(), { url: 'https://example.com' }, { fetchAndExtract });

    expect(output.content[0]?.text).not.toContain('<additional_content>');
    expect(output.content[0]?.text).not.toContain('llms.txt');
    expect(output.details.llmsTxt).toBe(llmsTxt);
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
