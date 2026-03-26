import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SimpleFetchAdapter } from './fetch.js';

let server: Server;
let baseUrl: string;

function handler(req: IncomingMessage, res: ServerResponse) {
  const url = req.url ?? '/';

  if (url === '/hello') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body><h1>Hello</h1></body></html>');
    return;
  }

  if (url === '/redirect') {
    res.writeHead(302, { Location: '/hello' });
    res.end();
    return;
  }

  if (url === '/not-found') {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<html><body>Not Found</body></html>');
    return;
  }

  if (url === '/slow') {
    // Don't respond — let the timeout trigger
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('default');
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

describe('SimpleFetchAdapter', () => {
  const adapter = new SimpleFetchAdapter();

  it('should fetch a simple HTML page', async () => {
    const result = await adapter.fetch(`${baseUrl}/hello`);
    expect(result.statusCode).toBe(200);
    expect(result.html).toContain('<h1>Hello</h1>');
    expect(result.contentType).toContain('text/html');
  });

  it('should follow redirects and return the final URL', async () => {
    const result = await adapter.fetch(`${baseUrl}/redirect`);
    expect(result.statusCode).toBe(200);
    expect(result.url).toContain('/hello');
    expect(result.html).toContain('<h1>Hello</h1>');
  });

  it('should return 404 status for not-found pages', async () => {
    const result = await adapter.fetch(`${baseUrl}/not-found`);
    expect(result.statusCode).toBe(404);
  });

  it('should respect custom headers', async () => {
    const result = await adapter.fetch(`${baseUrl}/hello`, {
      headers: { 'X-Custom': 'test' },
    });
    expect(result.statusCode).toBe(200);
  });

  it('should timeout on slow responses', async () => {
    await expect(adapter.fetch(`${baseUrl}/slow`, { timeoutMs: 100 })).rejects.toThrow();
  });
});
