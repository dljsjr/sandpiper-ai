import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearLlmsTxtProbeCache, probeLlmsTxt } from './llms-txt.js';

let server: Server;
let baseUrl: string;
let mode: 'found' | 'missing' | 'method-not-allowed' | 'server-error';
let headCount = 0;
let getCount = 0;

function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.url !== '/llms.txt') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body>Page</body></html>');
    return;
  }

  if (req.method === 'GET') getCount += 1;
  if (req.method === 'HEAD') headCount += 1;

  if (mode === 'found') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (mode === 'missing') {
    res.writeHead(404);
    res.end();
    return;
  }

  if (mode === 'method-not-allowed') {
    res.writeHead(405, { Allow: 'GET' });
    res.end();
    return;
  }

  res.writeHead(500);
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
  mode = 'found';
  headCount = 0;
  getCount = 0;
  clearLlmsTxtProbeCache();
});

describe('probeLlmsTxt', () => {
  it('detects an existing llms.txt with HEAD and caches by origin', async () => {
    const first = await probeLlmsTxt(`${baseUrl}/docs/page`);
    const second = await probeLlmsTxt(`${baseUrl}/other/page`);

    expect(first).toMatchObject({
      checked: true,
      exists: true,
      status: 'found',
      statusCode: 204,
      url: `${baseUrl}/llms.txt`,
    });
    expect(second).toEqual(first);
    expect(headCount).toBe(1);
    expect(getCount).toBe(0);
  });

  it('reports missing when HEAD returns 404', async () => {
    mode = 'missing';

    const result = await probeLlmsTxt(`${baseUrl}/docs/page`);

    expect(result).toMatchObject({
      checked: true,
      exists: false,
      status: 'missing',
      statusCode: 404,
      url: `${baseUrl}/llms.txt`,
    });
    expect(headCount).toBe(1);
    expect(getCount).toBe(0);
  });

  it('reports unknown on 405 without falling back to GET', async () => {
    mode = 'method-not-allowed';

    const result = await probeLlmsTxt(`${baseUrl}/docs/page`);

    expect(result).toMatchObject({
      checked: true,
      exists: null,
      status: 'unknown',
      statusCode: 405,
      reason: 'head-not-allowed',
      allow: 'GET',
      url: `${baseUrl}/llms.txt`,
    });
    expect(headCount).toBe(1);
    expect(getCount).toBe(0);
  });

  it('reports unknown instead of throwing when the probe fails', async () => {
    const result = await probeLlmsTxt('http://127.0.0.1:1/docs/page', { timeoutMs: 50 });

    expect(result.checked).toBe(true);
    expect(result.exists).toBeNull();
    expect(result.status).toBe('unknown');
    expect(result.reason).toBeDefined();
  });

  it('reports unknown for unexpected non-404 failures', async () => {
    mode = 'server-error';

    const result = await probeLlmsTxt(`${baseUrl}/docs/page`);

    expect(result).toMatchObject({
      checked: true,
      exists: null,
      status: 'unknown',
      statusCode: 500,
      reason: 'unexpected-status',
    });
    expect(headCount).toBe(1);
    expect(getCount).toBe(0);
  });
});
