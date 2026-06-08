/**
 * Tests for DdgSearchAdapter.
 *
 * These tests use Piper's static SERP fixture so they never hit the network.
 * The fixture lives at `src/__fixtures__/ddg-serp.html` and covers:
 *   - Normal results (title, uddg-wrapped URL, snippet)
 *   - Empty query handling
 *   - CAPTCHA/bot challenge detection
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DdgSearchAdapter } from './ddg-adapter.js';

// ---------------------------------------------------------------------------
// Fixture loading
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): string {
  const path = resolve(__dirname, '__fixtures__', name);
  return readFileSync(path, 'utf-8');
}

// ---------------------------------------------------------------------------
// Fake HTML fixtures
// ---------------------------------------------------------------------------

function captchaPage(): string {
  return `<!DOCTYPE html><html><body>
    <h1>DuckDuckGo — Challenge</h1>
    <p>Please complete the following challenge to verify this search was made by a human.</p>
    <form><input type="checkbox" /> Select all squares containing a duck</form>
  </body></html>`;
}

function noResultsPage(): string {
  return `<!DOCTYPE html><html><body>
    <div id="links" class="results">
      <div class="result--no-results">No results found.</div>
    </div>
  </body></html>`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DdgSearchAdapter', () => {
  let adapter: DdgSearchAdapter;

  beforeEach(() => {
    adapter = new DdgSearchAdapter();
  });

  describe('name', () => {
    it('returns "duckduckgo"', () => {
      expect(adapter.name).toBe('duckduckgo');
    });
  });

  describe('search', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockReset();
    });

    afterEach(() => {
      fetchSpy.mockRestore();
    });

    it('parses a normal SERP into structured results', async () => {
      const html = loadFixture('ddg-serp.html');
      fetchSpy.mockResolvedValue(
        new Response(html, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=UTF-8' },
        }),
      );

      const results = await adapter.search('example library');

      expect(results).toHaveLength(5);
      expect(results[0]).toEqual({
        title: 'Getting Started with Example Library',
        url: 'https://example.com/docs/getting-started',
        snippet: expect.stringContaining('comprehensive guide'),
      });
      expect(results[1]).toEqual({
        title: 'example/example-lib: A library for doing things - GitHub',
        url: 'https://github.com/example/example-lib',
        snippet: expect.stringContaining('1.2k stars'),
      });
      expect(results[4]).toEqual({
        title: 'example-lib - npm',
        url: 'https://www.npmjs.com/package/example-lib',
        snippet: expect.stringContaining('50,000'),
      });
    });

    it('respects the count option', async () => {
      const html = loadFixture('ddg-serp.html');
      fetchSpy.mockResolvedValue(
        new Response(html, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=UTF-8' },
        }),
      );

      const results = await adapter.search('example', { count: 2 });
      expect(results).toHaveLength(2);
      expect(results[0]?.title).toBe('Getting Started with Example Library');
      expect(results[1]?.title).toBe('example/example-lib: A library for doing things - GitHub');
    });

    it('returns empty for empty query', async () => {
      const results = await adapter.search('');
      expect(results).toEqual([]);
    });

    it('returns empty for whitespace-only query', async () => {
      const results = await adapter.search('   ');
      expect(results).toEqual([]);
    });

    it('returns empty when the page has no result nodes', async () => {
      fetchSpy.mockResolvedValue(
        new Response(noResultsPage(), {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=UTF-8' },
        }),
      );

      const results = await adapter.search('asdfghjkzxcvbnm');
      expect(results).toEqual([]);
    });

    it('throws a clear error when DDG returns a CAPTCHA', async () => {
      fetchSpy.mockResolvedValue(
        new Response(captchaPage(), {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=UTF-8' },
        }),
      );

      await expect(adapter.search('test')).rejects.toThrow(/CAPTCHA/);
    });

    it('passes the query as a URL parameter', async () => {
      fetchSpy.mockResolvedValue(
        new Response(noResultsPage(), {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=UTF-8' },
        }),
      );

      await adapter.search('test query');

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('q=test+query');
    });

    it('decodes uddg-wrapped URLs to real destinations', async () => {
      const html = loadFixture('ddg-serp.html');
      fetchSpy.mockResolvedValue(
        new Response(html, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=UTF-8' },
        }),
      );

      const results = await adapter.search('example library');
      for (const r of results) {
        expect(r.url).not.toContain('duckduckgo.com/l/');
        expect(r.url).toMatch(/^https?:\/\//);
      }
    });

    it('sends realistic browser-like headers', async () => {
      fetchSpy.mockResolvedValue(
        new Response(noResultsPage(), {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=UTF-8' },
        }),
      );

      await adapter.search('test');

      const callHeaders = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
      expect(callHeaders['User-Agent']).toContain('Mozilla');
      expect(callHeaders['Accept-Language']).toContain('en-US');
    });

    it('aborts on timeout', { timeout: 10_000 }, async () => {
      // A fetch that never resolves — timeout should abort it.
      fetchSpy.mockImplementation(async (_url: string, options?: { signal?: AbortSignal }) => {
        return new Promise<never>((_resolve, reject) => {
          if (options?.signal) {
            options.signal.addEventListener(
              'abort',
              () => {
                reject(new DOMException('Aborted', 'AbortError'));
              },
              { once: true },
            );
          }
        });
      });

      const promise = adapter.search('test', { timeoutMs: 50 });
      await expect(promise).rejects.toThrow();
    });
  });
});
