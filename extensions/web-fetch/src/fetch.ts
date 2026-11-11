/**
 * HTTP fetch adapter using the standard Fetch API.
 * Framework-independent — no pi imports.
 */

import type { FetchAdapter, FetchResult } from './types.js';

const DEFAULT_TIMEOUT_MS = 30_000;

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': 'Sandpiper/1.0 (web-fetch tool; +https://github.com/sandpiper-ai)',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

export class SimpleFetchAdapter implements FetchAdapter {
  async fetch(url: string): Promise<FetchResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await globalThis.fetch(url, {
        headers: DEFAULT_HEADERS,
        signal: controller.signal,
        redirect: 'follow',
      });

      const body = await response.text();
      const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();

      return {
        url: response.url,
        statusCode: response.status,
        body,
        ...(contentType ? { contentType } : {}),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
