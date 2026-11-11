/**
 * HTTP fetch adapter using the standard Fetch API.
 * Framework-independent — no pi imports.
 */

import type { FetchAdapter, FetchOptions, FetchResult } from './types.js';

const DEFAULT_TIMEOUT_MS = 30_000;

const USER_AGENT = 'Sandpiper/1.0 (web-fetch tool; +https://github.com/sandpiper-ai)';
const ACCEPT_HTML = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
// Some documentation sites answer this with their own Markdown version of the page.
const ACCEPT_MARKDOWN_FIRST =
  'text/markdown,text/html;q=0.9,application/xhtml+xml;q=0.9,application/xml;q=0.8,*/*;q=0.7';

export class SimpleFetchAdapter implements FetchAdapter {
  async fetch(url: string, options: FetchOptions = {}): Promise<FetchResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await globalThis.fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: options.htmlOnly ? ACCEPT_HTML : ACCEPT_MARKDOWN_FIRST },
        signal: controller.signal,
        redirect: 'follow',
      });

      const body = await response.text();
      const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
      const linkHeader = response.headers.get('link');

      return {
        url: response.url,
        statusCode: response.status,
        body,
        ...(contentType ? { contentType } : {}),
        ...(linkHeader ? { linkHeader } : {}),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
