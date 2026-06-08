/**
 * Brave Search API adapter.
 *
 * ⚠️ STUB — proves the SearchAdapter swap compiles. Replace with a real Brave Search API
 * implementation once Doug provides a BRAVE_API_KEY. See SCOUT.md for the API surface.
 *
 * Brave Search API (free tier: 2k queries/month):
 *   GET https://api.search.brave.com/res/v1/web/search
 *   Header: X-Subscription-Token: <key>
 *   Params: q=<query>&count=<n>
 *   Response: web.results[].{title, url, description}
 */

import { type SearchAdapter, type SearchAdapterOptions, type SearchResultItem, DEFAULT_RESULT_COUNT } from './types.js';

export class BraveSearchAdapter implements SearchAdapter {
  readonly name = 'brave';

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async search(query: string, options?: SearchAdapterOptions): Promise<SearchResultItem[]> {
    const _count = options?.count ?? DEFAULT_RESULT_COUNT;
    throw new Error(
      'BraveSearchAdapter.search is not implemented yet (stub). ' +
        'Requires a BRAVE_API_KEY. Replace the stub with:\n' +
        '  GET https://api.search.brave.com/res/v1/web/search\n' +
        '  Header: X-Subscription-Token: $BRAVE_API_KEY\n' +
        '  Params: q=<query>&count=<n>\n' +
        '  Response: web.results[] -> {title, url: url, snippet: description}',
    );
  }
}
