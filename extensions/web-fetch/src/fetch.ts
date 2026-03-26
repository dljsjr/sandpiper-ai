/**
 * HTTP fetch adapter using the standard Fetch API.
 * Framework-independent — no pi imports.
 */

import type { FetchAdapter, FetchOptions, FetchResult } from './types.js';

const DEFAULT_TIMEOUT_MS = 30_000;

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': 'Sandpiper/1.0 (web-fetch tool; +https://github.com/sandpiper-ai)',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

export class SimpleFetchAdapter implements FetchAdapter {
  async fetch(url: string, options?: FetchOptions): Promise<FetchResult> {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const headers = { ...DEFAULT_HEADERS, ...options?.headers };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await globalThis.fetch(url, {
        headers,
        signal: controller.signal,
        redirect: 'follow',
      });

      const html = await response.text();

      return {
        url: response.url,
        statusCode: response.status,
        html,
        contentType: response.headers.get('content-type') ?? '',
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
