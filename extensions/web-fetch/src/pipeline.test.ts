import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SimpleFetchAdapter } from './fetch.js';
import { fetchAndExtract } from './pipeline.js';

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

let server: Server;
let baseUrl: string;

function handler(req: IncomingMessage, res: ServerResponse) {
  const url = req.url ?? '/';

  if (url === '/article') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(ARTICLE_PAGE);
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

  it('should extract links when followLinks is true', async () => {
    const result = await fetchAndExtract(adapter, `${baseUrl}/article`, { followLinks: true });
    expect(result.links).toBeDefined();
    expect(result.links?.length).toBeGreaterThan(0);
    const docLink = result.links?.find((l) => l.href.includes('example.com/docs'));
    expect(docLink).toBeDefined();
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
