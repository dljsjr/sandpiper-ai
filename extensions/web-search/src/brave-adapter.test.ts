/**
 * Tests for BraveSearchAdapter.
 * Mocks global fetch with Brave-shaped JSON so they never hit the network.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BraveSearchAdapter } from './brave-adapter.js';

function braveResponse(results: Array<{ title?: string; url?: string; description?: string }>): Response {
  return new Response(JSON.stringify({ web: { results } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('BraveSearchAdapter', () => {
  let adapter: BraveSearchAdapter;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    adapter = new BraveSearchAdapter('test-key');
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockReset();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('returns "brave" as its name', () => {
    expect(adapter.name).toBe('brave');
  });

  it('parses web.results into structured items and strips HTML highlights', async () => {
    fetchSpy.mockResolvedValue(
      braveResponse([
        {
          title: 'Async <strong>Rust</strong> Book',
          url: 'https://rust-lang.github.io/async-book/',
          description: 'The <strong>async</strong> book &amp; guide.',
        },
        { title: 'Tokio', url: 'https://tokio.rs/', description: 'An async runtime.' },
      ]),
    );

    const results = await adapter.search('rust async');

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      title: 'Async Rust Book',
      url: 'https://rust-lang.github.io/async-book/',
      snippet: 'The async book & guide.',
    });
    expect(results[1]?.url).toBe('https://tokio.rs/');
  });

  it('respects the count option', async () => {
    fetchSpy.mockResolvedValue(
      braveResponse([
        { title: 'a', url: 'https://a.test/', description: 'a' },
        { title: 'b', url: 'https://b.test/', description: 'b' },
        { title: 'c', url: 'https://c.test/', description: 'c' },
      ]),
    );

    const results = await adapter.search('x', { count: 2 });
    expect(results).toHaveLength(2);
  });

  it('sends the query and count in the request and the subscription-token header', async () => {
    fetchSpy.mockResolvedValue(braveResponse([]));
    await adapter.search('hello world', { count: 5 });

    const [calledUrl, init] = fetchSpy.mock.calls[0] as [URL, RequestInit];
    expect(calledUrl.toString()).toContain('q=hello+world');
    expect(calledUrl.toString()).toContain('count=5');
    expect((init.headers as Record<string, string>)['X-Subscription-Token']).toBe('test-key');
  });

  it('returns empty for an empty/whitespace query without calling fetch', async () => {
    expect(await adapter.search('')).toEqual([]);
    expect(await adapter.search('   ')).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('drops results without a url', async () => {
    fetchSpy.mockResolvedValue(
      braveResponse([
        { title: 'no url', description: 'x' },
        { title: 'ok', url: 'https://ok.test/', description: 'y' },
      ]),
    );
    const results = await adapter.search('x');
    expect(results).toHaveLength(1);
    expect(results[0]?.url).toBe('https://ok.test/');
  });

  it('throws a clear error on a rejected key (401)', async () => {
    fetchSpy.mockResolvedValue(new Response('', { status: 401 }));
    await expect(adapter.search('x')).rejects.toThrow(/key/i);
  });

  it('throws a clear error on rate limit (429)', async () => {
    fetchSpy.mockResolvedValue(new Response('', { status: 429 }));
    await expect(adapter.search('x')).rejects.toThrow(/rate limit/i);
  });
});
