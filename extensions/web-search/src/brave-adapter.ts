/**
 * Brave Search API adapter — the keyed, primary provider.
 *
 * Brave Search API (free tier: ~2k queries/month):
 *   GET https://api.search.brave.com/res/v1/web/search
 *   Header: X-Subscription-Token: <key>
 *   Params: q=<query>&count=<n>  (count max 20)
 *   Response: web.results[].{title, url, description}  (title/description may carry HTML highlight tags)
 *
 * The key is resolved upstream (see adapter-selection.ts) — this adapter just takes a
 * resolved key and talks to Brave. Keeps the adapter pure and the secret-resolution wiring elsewhere.
 */

import {
  DEFAULT_RESULT_COUNT,
  MAX_RESULT_COUNT,
  type SearchAdapter,
  type SearchAdapterOptions,
  type SearchResultItem,
} from './types.js';

const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';
const DEFAULT_TIMEOUT_MS = 10_000;

/** Strip HTML tags (Brave highlights matches with <strong>) and decode a few common entities. */
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

interface BraveWebResult {
  readonly title?: string;
  readonly url?: string;
  readonly description?: string;
}

export class BraveSearchAdapter implements SearchAdapter {
  readonly name = 'brave';

  constructor(private readonly apiKey: string) {}

  async search(query: string, options?: SearchAdapterOptions): Promise<SearchResultItem[]> {
    const trimmed = query.trim();
    if (trimmed === '') {
      return [];
    }

    const count = Math.min(options?.count ?? DEFAULT_RESULT_COUNT, MAX_RESULT_COUNT);
    const url = new URL(BRAVE_ENDPOINT);
    url.searchParams.set('q', trimmed);
    url.searchParams.set('count', String(count));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Subscription-Token': this.apiKey,
          Accept: 'application/json',
          'Accept-Encoding': 'gzip',
        },
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Brave rejected the API key (HTTP ${response.status}). Check the configured Brave key.`);
      }
      if (response.status === 429) {
        throw new Error('Brave rate limit hit (HTTP 429). The free tier is ~2k queries/month.');
      }
      if (!response.ok) {
        throw new Error(`Brave search failed: HTTP ${response.status}`);
      }

      const data = (await response.json()) as { web?: { results?: BraveWebResult[] } };
      const results = data.web?.results ?? [];

      return results
        .slice(0, count)
        .filter((r): r is BraveWebResult & { url: string } => typeof r.url === 'string' && r.url.length > 0)
        .map((r) => ({
          title: stripHtml(r.title ?? ''),
          url: r.url,
          snippet: stripHtml(r.description ?? ''),
        }));
    } finally {
      clearTimeout(timer);
    }
  }
}
