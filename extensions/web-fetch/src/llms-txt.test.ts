import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearLlmsTxtProbeCache, declaredLlmsTxt, discoverLlmsTxt, llmsTxtCandidates } from './llms-txt.js';

type Mode = 'found' | 'found-as-markdown' | 'html-page' | 'untyped' | 'method-not-allowed' | 'server-error';

let server: Server;
let baseUrl: string;
/** How the server answers each llms.txt path. Unlisted paths are 404. */
let files: Map<string, Mode>;
let headCounts: Map<string, number>;
let getCount = 0;
/** When set, HEAD responses wait until this many HEAD requests are in flight. */
let holdUntilConcurrent = 0;
let held: (() => void)[] = [];

function respond(res: ServerResponse, mode: Mode | undefined): void {
  if (mode === 'found') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  } else if (mode === 'found-as-markdown') {
    res.writeHead(200, { 'Content-Type': 'text/markdown' });
  } else if (mode === 'html-page') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  } else if (mode === 'untyped') {
    res.writeHead(204);
  } else if (mode === 'method-not-allowed') {
    res.writeHead(405, { Allow: 'GET' });
  } else if (mode === 'server-error') {
    res.writeHead(500);
  } else {
    res.writeHead(404);
  }
  res.end();
}

function handler(req: IncomingMessage, res: ServerResponse) {
  const path = req.url ?? '/';
  if (req.method === 'GET') getCount += 1;
  if (req.method === 'HEAD') headCounts.set(path, (headCounts.get(path) ?? 0) + 1);

  const send = () => respond(res, files.get(path));
  if (holdUntilConcurrent === 0) return send();

  held.push(send);
  if (held.length >= holdUntilConcurrent) {
    for (const release of held) release();
    held = [];
  }
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
  files = new Map([['/llms.txt', 'found']]);
  headCounts = new Map();
  getCount = 0;
  holdUntilConcurrent = 0;
  held = [];
  clearLlmsTxtProbeCache();
});

describe('llmsTxtCandidates', () => {
  it('lists the llms.txt location of each directory above the page, most specific first', () => {
    expect(llmsTxtCandidates('https://example.com/docs/guide/page.html?x=1#top')).toEqual([
      'https://example.com/docs/guide/llms.txt',
      'https://example.com/docs/llms.txt',
      'https://example.com/llms.txt',
    ]);
  });

  it('treats a path that ends with a slash as a directory', () => {
    expect(llmsTxtCandidates('https://example.com/docs/')).toEqual([
      'https://example.com/docs/llms.txt',
      'https://example.com/llms.txt',
    ]);
    expect(llmsTxtCandidates('https://example.com')).toEqual(['https://example.com/llms.txt']);
  });

  it('keeps the root and the three directories nearest to it for a deep page', () => {
    expect(llmsTxtCandidates('https://example.com/a/b/c/d/e/page')).toEqual([
      'https://example.com/a/b/c/llms.txt',
      'https://example.com/a/b/llms.txt',
      'https://example.com/a/llms.txt',
      'https://example.com/llms.txt',
    ]);
  });
});

describe('discoverLlmsTxt', () => {
  it('finds llms.txt at the site root with HEAD requests only', async () => {
    const result = await discoverLlmsTxt(`${baseUrl}/docs/page`);

    expect(result).toMatchObject({
      checked: true,
      exists: true,
      status: 'found',
      statusCode: 200,
      url: `${baseUrl}/llms.txt`,
    });
    expect(getCount).toBe(0);
  });

  it('accepts an answer served as Markdown', async () => {
    files = new Map([['/llms.txt', 'found-as-markdown']]);

    const result = await discoverLlmsTxt(`${baseUrl}/page`);

    expect(result).toMatchObject({ status: 'found', url: `${baseUrl}/llms.txt` });
  });

  it.each([
    ['an HTML page', 'html-page'],
    ['an answer with no media type', 'untyped'],
  ] as const)('does not accept %s as an llms.txt file', async (_name, mode) => {
    files.set('/docs/llms.txt', mode);

    const result = await discoverLlmsTxt(`${baseUrl}/docs/page`);

    expect(result).toMatchObject({ status: 'found', url: `${baseUrl}/llms.txt` });
  });

  it('reports a location that answers with something other than Markdown as missing', async () => {
    files = new Map([['/llms.txt', 'html-page']]);

    const result = await discoverLlmsTxt(`${baseUrl}/page`);

    expect(result).toMatchObject({
      checked: true,
      exists: false,
      status: 'missing',
      statusCode: 200,
      reason: 'not-markdown',
      url: `${baseUrl}/llms.txt`,
    });
  });

  it('prefers the most specific llms.txt above the page', async () => {
    files.set('/docs/llms.txt', 'found');

    const result = await discoverLlmsTxt(`${baseUrl}/docs/guide/page.html`);

    expect(result).toMatchObject({ status: 'found', url: `${baseUrl}/docs/llms.txt` });
  });

  it('finds a path-scoped llms.txt when the root has none', async () => {
    files = new Map([['/docs/llms.txt', 'found']]);

    const result = await discoverLlmsTxt(`${baseUrl}/docs/tutorials/by_example.html`);

    expect(result).toMatchObject({ status: 'found', url: `${baseUrl}/docs/llms.txt` });
  });

  it('probes each location once per process', async () => {
    await discoverLlmsTxt(`${baseUrl}/docs/a.html`);
    await discoverLlmsTxt(`${baseUrl}/docs/b.html`);
    await discoverLlmsTxt(`${baseUrl}/api/c.html`);

    expect(Object.fromEntries(headCounts)).toEqual({ '/llms.txt': 1, '/docs/llms.txt': 1, '/api/llms.txt': 1 });
  });

  it('probes the locations at the same time', async () => {
    files.set('/a/b/llms.txt', 'found');
    holdUntilConcurrent = 3;

    const result = await discoverLlmsTxt(`${baseUrl}/a/b/page`, { timeoutMs: 1_000 });

    expect(result).toMatchObject({ status: 'found', url: `${baseUrl}/a/b/llms.txt` });
  });

  it('reports missing when no location has the file', async () => {
    files = new Map();

    const result = await discoverLlmsTxt(`${baseUrl}/docs/page`);

    expect(result).toMatchObject({
      checked: true,
      exists: false,
      status: 'missing',
      statusCode: 404,
      url: `${baseUrl}/llms.txt`,
    });
    expect(getCount).toBe(0);
  });

  it('reports unknown on 405 without falling back to GET', async () => {
    files = new Map([['/llms.txt', 'method-not-allowed']]);

    const result = await discoverLlmsTxt(`${baseUrl}/docs/page`);

    expect(result).toMatchObject({
      checked: true,
      exists: null,
      status: 'unknown',
      statusCode: 405,
      reason: 'head-not-allowed',
      allow: 'GET',
      url: `${baseUrl}/llms.txt`,
    });
    expect(getCount).toBe(0);
  });

  it('reports unknown instead of throwing when the probe fails, and does not retry', async () => {
    const result = await discoverLlmsTxt('http://127.0.0.1:1/docs/page', { timeoutMs: 50 });
    const again = await discoverLlmsTxt('http://127.0.0.1:1/docs/page', { timeoutMs: 50 });

    expect(result.checked).toBe(true);
    expect(result.exists).toBeNull();
    expect(result.status).toBe('unknown');
    expect(result.reason).toBeDefined();
    expect(again).toBe(result);
  });

  it('reports unknown for unexpected non-404 failures', async () => {
    files = new Map([['/llms.txt', 'server-error']]);

    const result = await discoverLlmsTxt(`${baseUrl}/docs/page`);

    expect(result).toMatchObject({
      checked: true,
      exists: null,
      status: 'unknown',
      statusCode: 500,
      reason: 'unexpected-status',
    });
  });
});

describe('declaredLlmsTxt', () => {
  it('reports a file the page declared as found without a request', () => {
    expect(
      declaredLlmsTxt('https://example.com/docs/llms.txt', { now: () => new Date('2026-11-11T00:00:00Z') }),
    ).toEqual({
      checked: false,
      exists: true,
      status: 'found',
      url: 'https://example.com/docs/llms.txt',
      checkedAt: '2026-11-11T00:00:00.000Z',
    });
  });
});
