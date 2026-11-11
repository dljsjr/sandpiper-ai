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

  if (url === '/linked') {
    res.writeHead(200, { 'Content-Type': 'text/html', Link: '</docs/llms.txt>; rel="describedby"' });
    res.end('<html><body><h1>Linked</h1></body></html>');
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

  res.writeHead(200, { 'Content-Type': 'Text/Plain; charset=utf-8' });
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
    expect(result.body).toContain('<h1>Hello</h1>');
  });

  it('should follow redirects and return the final URL', async () => {
    const result = await adapter.fetch(`${baseUrl}/redirect`);
    expect(result.statusCode).toBe(200);
    expect(result.url).toContain('/hello');
    expect(result.body).toContain('<h1>Hello</h1>');
  });

  it('should report the media type without its parameters', async () => {
    const html = await adapter.fetch(`${baseUrl}/hello`);
    const text = await adapter.fetch(`${baseUrl}/charset`);

    expect(html.contentType).toBe('text/html');
    expect(text.contentType).toBe('text/plain');
    expect(text.body).toBe('default');
  });

  it('should report the Link header when the server sends one', async () => {
    const linked = await adapter.fetch(`${baseUrl}/linked`);
    const plain = await adapter.fetch(`${baseUrl}/hello`);

    expect(linked.linkHeader).toBe('</docs/llms.txt>; rel="describedby"');
    expect(plain.linkHeader).toBeUndefined();
  });

  it('should return 404 status for not-found pages', async () => {
    const result = await adapter.fetch(`${baseUrl}/not-found`);
    expect(result.statusCode).toBe(404);
  });
});
