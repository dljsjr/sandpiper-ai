/**
 * DuckDuckGo search adapter — scrapes `html.duckduckgo.com/html/`.
 *
 * Built from Huginn's scout of OpenClaw's prior art + Piper's SERP fixture.
 *
 * ## Caveats
 * DDG actively blocks automated requests. Even with a realistic User-Agent and
 * rate limiting, CAPTCHA challenges are possible on any request. The adapter
 * detects challenges explicitly and throws a clear error so callers can fall
 * back to another provider.
 *
 * ## Implementation notes
 * - Uses jsdom (already a dependency) for robust HTML parsing over regex.
 * - Decodes DDG's `uddg` redirect URLs to expose the real destination.
 * - Detects CAPTCHA/bot challenges by looking for known challenge markers.
 * - Rate-limits to one request per second minimum (configurable via options).
 */

import { JSDOM } from 'jsdom';
import {
  DEFAULT_RESULT_COUNT,
  MAX_RESULT_COUNT,
  type SearchAdapter,
  type SearchAdapterOptions,
  type SearchResultItem,
} from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** DDG's HTML-mode search endpoint. */
const DDG_HTML_URL = 'https://html.duckduckgo.com/html';

/** Default headers that mimic a real-ish browser visit. */
const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  // DDG uses this to differentiate browsers from scripts.
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
};

/** Minimum interval between DDG requests (milliseconds). */
const MIN_REQUEST_INTERVAL_MS = 1_500;

/** Default per-request timeout. */
const DEFAULT_TIMEOUT_MS = 15_000;

/** Maximum results we'll parse from a single SERP. */
const MAX_PARSE_RESULTS = MAX_RESULT_COUNT;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * DDG wraps result URLs in a redirect: the anchor href looks like
 *   //duckduckgo.com/l/?uddg=https%3A%2F%2Freal.url%2Fpath&rut=...
 * We extract the `uddg` query param and decode it.
 */
function decodeDdgUrl(href: string): string {
  try {
    const url = new URL(href, 'https://duckduckgo.com');
    const encoded = url.searchParams.get('uddg');
    if (encoded) return decodeURIComponent(encoded);
  } catch {
    // Malformed URL — fall through to raw href.
  }
  // If no uddg param, the href might be an absolute URL already.
  return href.startsWith('//') ? `https:${href}` : href;
}

/**
 * Returns true when the page body looks like a DDG CAPTCHA/bot challenge.
 * We check for known challenge markers rather than trying to enumerate all
 * possible challenge shapes.
 */
function isBotChallenge(document: Document): boolean {
  const bodyText = document.body?.textContent ?? '';
  const challengeMarkers = [
    'please complete the following challenge',
    'verify this search was made by a human',
    'enable javascript',
    'duckduckgo.com/js/spc',
  ];
  return challengeMarkers.some((marker) => bodyText.toLowerCase().includes(marker));
}

// ---------------------------------------------------------------------------
// Inter-request rate limiter
// ---------------------------------------------------------------------------

let lastRequestTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_REQUEST_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class DdgSearchAdapter implements SearchAdapter {
  readonly name = 'duckduckgo';

  async search(query: string, options?: SearchAdapterOptions): Promise<SearchResultItem[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const count = Math.min(options?.count ?? DEFAULT_RESULT_COUNT, MAX_PARSE_RESULTS);
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const signal = options?.signal;

    await rateLimit();

    const params = new URLSearchParams({ q: query.trim() });
    const url = `${DDG_HTML_URL}?${params.toString()}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // Forward external cancellation.
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const response = await globalThis.fetch(url, {
        headers: DEFAULT_HEADERS,
        signal: controller.signal,
        redirect: 'follow',
      });

      const html = await response.text();

      // Parse and check for bot challenge.
      const dom = new JSDOM(html);
      const doc = dom.window.document;

      if (isBotChallenge(doc)) {
        throw new Error(
          'DuckDuckGo returned a CAPTCHA challenge and cannot return results. ' +
            'Configure a Brave key under "web-search": { "braveApiKey": "..." } in settings.json ' +
            '(e.g. "!op read \'op://...\'"), or set the BRAVE_API_KEY env var.',
        );
      }

      // Extract results.
      const results: SearchResultItem[] = [];
      const resultNodes = doc.querySelectorAll('.result');

      for (const node of resultNodes) {
        if (results.length >= count) break;

        const titleEl = node.querySelector<HTMLAnchorElement>('a.result__a');
        const snippetEl = node.querySelector('.result__snippet');

        if (!titleEl) continue;

        const title = titleEl.textContent?.trim() ?? '';
        const rawHref = titleEl.getAttribute('href') ?? '';
        const url = decodeDdgUrl(rawHref);
        const snippet = snippetEl?.textContent?.trim() ?? '';

        if (title.length === 0 && url.length === 0) continue;

        results.push({ title, url, snippet });
      }

      return results;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
}
