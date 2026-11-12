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
      body: '<h1>Example</h1>',
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

  it("names the site's Markdown version when the content came from it", () => {
    const output = formatWebFetchResult(
      createResult({
        title: '',
        excerpt: '',
        byline: '',
        siteName: '',
        markdownSource: 'https://example.com/final.md',
      }),
    );

    expect(output).toBe(
      'URL: https://example.com/final\nMarkdown source: https://example.com/final.md\n\nExample body',
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

    expect(
      output.endsWith(
        [
          '<additional_content>',
          '  <instructions>This site publishes an index of its pages for language models at the llms_txt url. To find another page on this site, fetch that index with web_fetch instead of guessing a URL. The index is Markdown: a markdown_section filter with one of its headings returns that part alone.</instructions>',
          '  <llms_txt',
          '    status="found"',
          '    url="https://example.com/llms.txt"',
          '    http_status="200"',
          '  />',
          '</additional_content>',
        ].join('\n'),
      ),
    ).toBe(true);
  });

  it('omits the llms.txt metadata block when the fetched page is that llms.txt file', () => {
    const llmsTxt: LlmsTxtProbeResult = {
      checked: true,
      exists: true,
      status: 'found',
      url: 'https://example.com/llms.txt',
      checkedAt: '2026-05-13T00:00:00.000Z',
      statusCode: 200,
    };
    const output = formatWebFetchResult(createResult({ url: 'https://example.com/llms.txt', llmsTxt }));

    expect(output).not.toContain('<additional_content>');
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

  const two = () =>
    new Map([
      ['lightpanda', createAdapter()],
      ['obscura', createAdapter()],
    ]);

  it('uses the only renderer when the render switch is set', async () => {
    const lightpanda = createAdapter();
    const fetchAndExtract = vi.fn(async () => createResult());

    await executeWebFetchTool(
      createAdapter(),
      { url: 'https://example.com/app', render: true },
      { fetchAndExtract, renderAdapters: new Map([['lightpanda', lightpanda]]) },
    );

    expect(fetchAndExtract).toHaveBeenCalledWith(lightpanda, 'https://example.com/app', {
      filter: undefined,
      followLinks: undefined,
      render: true,
    });
  });

  it('uses the renderer the call names', async () => {
    const renderAdapters = two();
    const fetchAndExtract = vi.fn(async () => createResult());

    await executeWebFetchTool(
      createAdapter(),
      { url: 'https://example.com/app', renderer: 'obscura' },
      { fetchAndExtract, renderAdapters },
    );

    expect(fetchAndExtract).toHaveBeenCalledWith(renderAdapters.get('obscura'), 'https://example.com/app', {
      filter: undefined,
      followLinks: undefined,
      render: true,
    });
  });

  it.each([
    ['the renderer is none', { renderer: 'none' }],
    ['no renderer is named', {}],
    ['the render switch is off', { render: false }],
  ])('uses the plain adapter when %s', async (_name, rendering) => {
    const adapter = createAdapter();
    const fetchAndExtract = vi.fn(async () => createResult());

    await executeWebFetchTool(
      adapter,
      { url: 'https://example.com/page', ...rendering },
      { fetchAndExtract, renderAdapters: two() },
    );

    expect(fetchAndExtract).toHaveBeenCalledWith(adapter, 'https://example.com/page', {
      filter: undefined,
      followLinks: undefined,
    });
  });

  it('does not choose for the caller when the render switch is set and several renderers are loaded', async () => {
    const fetchAndExtract = vi.fn(async () => createResult());

    const output = await executeWebFetchTool(
      createAdapter(),
      { url: 'https://example.com/app', render: true },
      { fetchAndExtract, renderAdapters: two() },
    );

    expect(fetchAndExtract).not.toHaveBeenCalled();
    expect(output.content[0]?.text).toBe(
      'Failed to fetch https://example.com/app: several renderers are loaded. Set renderer to one of: lightpanda, obscura',
    );
  });

  it('names the loaded renderers when the call names one that is not loaded', async () => {
    const fetchAndExtract = vi.fn(async () => createResult());

    const output = await executeWebFetchTool(
      createAdapter(),
      { url: 'https://example.com/app', renderer: 'chrome' },
      { fetchAndExtract, renderAdapters: two() },
    );

    expect(fetchAndExtract).not.toHaveBeenCalled();
    expect(output.content[0]?.text).toBe(
      'Failed to fetch https://example.com/app: renderer "chrome" is not loaded. Loaded: lightpanda, obscura',
    );
  });

  it('explains that no renderer is loaded when rendering is requested without one', async () => {
    const fetchAndExtract = vi.fn(async () => createResult());

    const output = await executeWebFetchTool(
      createAdapter(),
      { url: 'https://example.com/app', render: true },
      { fetchAndExtract },
    );

    expect(fetchAndExtract).not.toHaveBeenCalled();
    expect(output.content[0]?.text).toBe(
      'Failed to fetch https://example.com/app: rendering is not available because no renderer is loaded',
    );
    expect(output.details.error).toBeDefined();
  });
});
