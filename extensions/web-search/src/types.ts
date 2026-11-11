/**
 * Core types for the web-search extension.
 * Framework-independent — no pi imports.
 *
 * This is the load-bearing seam: every search provider implements `SearchAdapter`,
 * mirroring web-fetch's `FetchAdapter`.
 */

/** A single search-result row. Deliberately minimal — title, url, snippet. */
export interface SearchResultItem {
  /** Result title / link text. */
  readonly title: string;
  /** Destination URL. Feed this to `web_fetch` to read the page. */
  readonly url: string;
  /** Short description / snippet from the result, if the provider supplies one. */
  readonly snippet: string;
}

/** Options passed to a search adapter. */
export interface SearchAdapterOptions {
  /** Max number of results to return. Adapters should treat this as an upper bound. */
  readonly count?: number;
}

/**
 * A search provider. One implementation per backend (Brave, Parallel).
 * The default count when unspecified is provider-defined but should be small (≈5).
 */
export interface SearchAdapter {
  /** Stable provider identifier, e.g. "brave", "parallel". Surfaced in tool result details. */
  readonly name: string;
  /** Run a single query and return ranked results (best-first), capped by `options.count`. */
  search(query: string, options?: SearchAdapterOptions): Promise<SearchResultItem[]>;
}

/** Default upper bound on results when the caller doesn't specify one. */
export const DEFAULT_RESULT_COUNT = 5;
/** Hard ceiling so a single call can't ask for an unbounded page. */
export const MAX_RESULT_COUNT = 20;
