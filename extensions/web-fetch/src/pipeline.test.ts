import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SimpleFetchAdapter } from './fetch.js';
import { clearLlmsTxtProbeCache } from './llms-txt.js';
import { fetchAndExtract } from './pipeline.js';
import { WebFetchFilterType } from './types.js';

const TARGETED_PAGE = `
<html>
<head><title>Target Test</title><meta name="description" content="Targeted extraction fixture"></head>
<body>
  <main>
    <section class="intro"><h2>Intro</h2><p>Intro content should be ignored.</p></section>
    <section id="api">
      <h2>API</h2>
      <p>Only API content should be returned.</p>
      <a href="/api/ref">API Reference</a>
    </section>
    <section class="appendix"><h2>Appendix</h2><p>Ignored appendix content.</p></section>
  </main>
</body>
</html>
`;

const SECTION_PAGE = `
<html>
<head><title>Section Test</title><meta name="author" content="Section Author"></head>
<body>
  <article>
    <h1>Section Test Article</h1>
    <p>Opening material should be ignored by a markdown section filter. This paragraph gives
    readability enough content to treat the document as an article-like page.</p>
    <h2>Overview</h2>
    <p>Overview content should be ignored when selecting configuration.</p>
    <p>See the <a href="/overview">overview guide</a>.</p>
    <h2>Configuration</h2>
    <p>Configuration content should be returned by the section filter.</p>
    <p>See the <a href="/config/reference">configuration reference</a> for details.</p>
    <h3>Advanced Configuration</h3>
    <p>Nested advanced configuration content should stay inside the selected section.</p>
    <h2><a href="#turbo-query"><code>turbo query</code> is now stable</a></h2>
    <p>Linked heading content should be selectable using plain heading text.</p>
    <h2>Reference</h2>
    <p>Reference content should not be returned by the section filter.</p>
    <p>See the <a href="/reference">reference guide</a>.</p>
  </article>
</body>
</html>
`;

const ARTICLE_PAGE = `
<html>
<head><title>Pipeline Test</title>
<meta name="author" content="Test Author">
</head>
<body>
  <nav><a href="/">Home</a><a href="/about">About</a></nav>
  <article>
    <h1>Pipeline Test Article</h1>
    <p>This is a test article with enough content for readability to extract.
    The article discusses important topics that are relevant to the reader.
    Multiple paragraphs ensure the content density is high enough.</p>
    <p>Second paragraph continues the discussion with additional details.
    It includes a <a href="https://example.com/docs">documentation link</a>
    and some <code>inline code</code> examples.</p>
    <p>Third paragraph wraps up the article content with final thoughts
    and conclusions about the subject matter discussed above.</p>
    <pre><code class="language-javascript">console.log("hello");</code></pre>
  </article>
  <footer><p>Footer content</p></footer>
</body>
</html>
`;

const RAW_CHANGELOG = [
  '# Changelog',
  '',
  'All notable changes are listed here.',
  '',
  '## [0.80.10] - 2026-07-01',
  '',
  '- Later release.',
  '',
  '## [0.80.1] - 2026-06-23',
  '',
  '- Fixed the   spacing bug.',
  '- See the [migration guide](https://example.com/migrate).',
  '',
  '```sh',
  '# not a heading',
  'bun   install',
  '```',
  '',
  '## [0.80.0] - 2026-06-01',
  '',
  '- First release.',
  '',
  '[0.80.10]: https://example.com/v0.80.10',
  '[0.80.1]: https://example.com/v0.80.1',
  '[0.80.0]: https://example.com/v0.80.0',
  '',
].join('\n');

let server: Server;
let baseUrl: string;

function handler(req: IncomingMessage, res: ServerResponse) {
  const url = req.url ?? '/';

  if (url === '/llms.txt') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (url === '/article') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(ARTICLE_PAGE);
    return;
  }

  if (url === '/targeted') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(TARGETED_PAGE);
    return;
  }

  if (url === '/sections') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(SECTION_PAGE);
    return;
  }

  if (url === '/CHANGELOG.md') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(RAW_CHANGELOG);
    return;
  }

  if (url === '/error') {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end('<html><body>Internal Server Error</body></html>');
    return;
  }

  if (url === '/minimal') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body><p>Tiny page</p></body></html>');
    return;
  }

  res.writeHead(404);
  res.end();
}

beforeAll(async () => {
  server = createServer(handler);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address();
  if (typeof addr === 'object' && addr) {
    baseUrl = `http://127.0.0.1:${addr.port}`;
  }
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

beforeEach(() => {
  clearLlmsTxtProbeCache();
});

describe('fetchAndExtract (end-to-end)', () => {
  const adapter = new SimpleFetchAdapter();

  it('should fetch and return markdown content from an article page', async () => {
    const result = await fetchAndExtract(adapter, `${baseUrl}/article`);
    // Readability extracts from <title> tag, not <h1>
    expect(result.title).toBe('Pipeline Test');
    expect(result.content).toContain('test article');
    // Should be markdown, not HTML
    expect(result.content).not.toContain('<p>');
    expect(result.content).not.toContain('<article>');
    // Should contain the code block
    expect(result.content).toContain('console.log');
  });

  it('should strip navigation and footer content', async () => {
    const result = await fetchAndExtract(adapter, `${baseUrl}/article`);
    expect(result.content).not.toContain('Footer content');
  });

  it('should include llms.txt probe metadata', async () => {
    const result = await fetchAndExtract(adapter, `${baseUrl}/article`);

    expect(result.llmsTxt).toMatchObject({
      checked: true,
      exists: true,
      status: 'found',
      statusCode: 204,
      url: `${baseUrl}/llms.txt`,
    });
  });

  it('should extract links when followLinks is true', async () => {
    const result = await fetchAndExtract(adapter, `${baseUrl}/article`, { followLinks: true });
    expect(result.links).toBeDefined();
    expect(result.links?.length).toBeGreaterThan(0);
    const docLink = result.links?.find((l) => l.href.includes('example.com/docs'));
    expect(docLink).toBeDefined();
  });

  it('should apply a CSS selector filter before markdown conversion', async () => {
    const result = await fetchAndExtract(adapter, `${baseUrl}/targeted`, {
      filter: { type: WebFetchFilterType.CssSelector, selector: '#api' },
    });

    expect(result.title).toBe('Target Test');
    expect(result.content).toContain('Only API content should be returned.');
    expect(result.content).not.toContain('Intro content should be ignored.');
    expect(result.content).not.toContain('Ignored appendix content.');
    expect(result.filter).toEqual({ type: WebFetchFilterType.CssSelector, matched: true, matchCount: 1 });
  });

  it('should extract links from the selected CSS fragment when followLinks is true', async () => {
    const result = await fetchAndExtract(adapter, `${baseUrl}/targeted`, {
      followLinks: true,
      filter: { type: WebFetchFilterType.CssSelector, selector: '#api' },
    });

    expect(result.links).toEqual([{ text: 'API Reference', href: '/api/ref' }]);
  });

  it('should return a non-fatal message when a CSS selector matches nothing', async () => {
    const result = await fetchAndExtract(adapter, `${baseUrl}/targeted`, {
      filter: { type: WebFetchFilterType.CssSelector, selector: '.missing' },
    });

    expect(result.content).toBe('No content matched CSS selector: .missing');
    expect(result.filter).toEqual({ type: WebFetchFilterType.CssSelector, matched: false, matchCount: 0 });
  });

  it('should return a non-fatal message when a CSS selector is invalid', async () => {
    const result = await fetchAndExtract(adapter, `${baseUrl}/targeted`, {
      filter: { type: WebFetchFilterType.CssSelector, selector: '[' },
    });

    expect(result.content).toContain('CSS selector filter failed:');
    expect(result.filter).toMatchObject({ type: WebFetchFilterType.CssSelector, matched: false, matchCount: 0 });
    expect(result.filter?.error).toBeDefined();
  });

  it('should apply a Markdown section filter after markdown conversion', async () => {
    const result = await fetchAndExtract(adapter, `${baseUrl}/sections`, {
      filter: { type: WebFetchFilterType.MarkdownSection, heading: 'Configuration' },
    });

    expect(result.title).toBe('Section Test');
    expect(result.content).toContain('## Configuration');
    expect(result.content).toContain('Configuration content should be returned by the section filter.');
    expect(result.content).toContain('Nested advanced configuration content should stay inside the selected section.');
    expect(result.content).not.toContain('Overview content should be ignored');
    expect(result.content).not.toContain('Reference content should not be returned');
    expect(result.filter).toEqual({ type: WebFetchFilterType.MarkdownSection, matched: true, matchCount: 1 });
  });

  it('should extract links from the selected Markdown section when followLinks is true', async () => {
    const result = await fetchAndExtract(adapter, `${baseUrl}/sections`, {
      followLinks: true,
      filter: { type: WebFetchFilterType.MarkdownSection, heading: 'Configuration' },
    });

    expect(result.links).toEqual([{ text: 'configuration reference', href: `${baseUrl}/config/reference` }]);
  });

  it('should match Markdown section headings after stripping link and code markup', async () => {
    const result = await fetchAndExtract(adapter, `${baseUrl}/sections`, {
      filter: { type: WebFetchFilterType.MarkdownSection, heading: 'turbo query is now stable' },
    });

    expect(result.content).toContain('Linked heading content should be selectable using plain heading text.');
    expect(result.content).not.toContain('Configuration content should be returned');
    expect(result.filter).toEqual({ type: WebFetchFilterType.MarkdownSection, matched: true, matchCount: 1 });
  });

  it('should return a non-fatal message when a Markdown section matches nothing', async () => {
    const result = await fetchAndExtract(adapter, `${baseUrl}/sections`, {
      filter: { type: WebFetchFilterType.MarkdownSection, heading: 'Missing Section' },
    });

    expect(result.content).toBe('No content matched Markdown section: Missing Section');
    expect(result.filter).toEqual({ type: WebFetchFilterType.MarkdownSection, matched: false, matchCount: 0 });
  });

  it('should return a plain-text Markdown document unchanged', async () => {
    const result = await fetchAndExtract(adapter, `${baseUrl}/CHANGELOG.md`);

    expect(result.content).toBe(RAW_CHANGELOG);
    expect(result.title).toBe('');
  });

  it('should apply a Markdown section filter to a plain-text Markdown document', async () => {
    const result = await fetchAndExtract(adapter, `${baseUrl}/CHANGELOG.md`, {
      filter: { type: WebFetchFilterType.MarkdownSection, heading: '[0.80.0] - 2026-06-01' },
    });

    expect(result.content).toBe(
      [
        '## [0.80.0] - 2026-06-01',
        '',
        '- First release.',
        '',
        '[0.80.10]: https://example.com/v0.80.10',
        '[0.80.1]: https://example.com/v0.80.1',
        '[0.80.0]: https://example.com/v0.80.0',
      ].join('\n'),
    );
    expect(result.filter).toEqual({ type: WebFetchFilterType.MarkdownSection, matched: true, matchCount: 1 });
  });

  it('should find a changelog release by its version in a plain-text Markdown document', async () => {
    const result = await fetchAndExtract(adapter, `${baseUrl}/CHANGELOG.md`, {
      filter: { type: WebFetchFilterType.MarkdownSection, heading: '0.80.1' },
    });

    expect(result.content).toBe(
      [
        '## [0.80.1] - 2026-06-23',
        '',
        '- Fixed the   spacing bug.',
        '- See the [migration guide](https://example.com/migrate).',
        '',
        '```sh',
        '# not a heading',
        'bun   install',
        '```',
      ].join('\n'),
    );
    expect(result.filter).toEqual({ type: WebFetchFilterType.MarkdownSection, matched: true, matchCount: 1 });
  });

  it('should extract links from a plain-text Markdown document when followLinks is true', async () => {
    const result = await fetchAndExtract(adapter, `${baseUrl}/CHANGELOG.md`, { followLinks: true });

    expect(result.links).toEqual([{ text: 'migration guide', href: 'https://example.com/migrate' }]);
  });

  it('should explain that a CSS selector cannot apply to a plain-text document', async () => {
    const result = await fetchAndExtract(adapter, `${baseUrl}/CHANGELOG.md`, {
      filter: { type: WebFetchFilterType.CssSelector, selector: 'h2' },
    });

    expect(result.content).toBe('CSS selector filter failed: the response is text/plain, not HTML');
    expect(result.filter).toEqual({
      type: WebFetchFilterType.CssSelector,
      matched: false,
      matchCount: 0,
      error: 'the response is text/plain, not HTML',
    });
  });

  it('should not include links when followLinks is false/undefined', async () => {
    const result = await fetchAndExtract(adapter, `${baseUrl}/article`);
    expect(result.links).toBeUndefined();
  });

  it('should return error message for HTTP errors', async () => {
    const result = await fetchAndExtract(adapter, `${baseUrl}/error`);
    expect(result.content).toContain('HTTP error: 500');
  });

  it('should fall back to raw conversion when readability fails', async () => {
    const result = await fetchAndExtract(adapter, `${baseUrl}/minimal`);
    // Should still return something — the turndown fallback
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
  });
});
