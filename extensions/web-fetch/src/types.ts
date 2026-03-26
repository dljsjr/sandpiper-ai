/**
 * Core types for the web-fetch extension.
 * Framework-independent — no pi imports.
 */

/** Options passed to the fetch adapter. */
export interface FetchOptions {
  /** Custom HTTP headers. */
  readonly headers?: Record<string, string>;
  /** Request timeout in milliseconds. */
  readonly timeoutMs?: number;
}

/** Raw result from the fetch adapter (before content extraction). */
export interface FetchResult {
  /** Final URL after redirects. */
  readonly url: string;
  /** HTTP status code. */
  readonly statusCode: number;
  /** Raw HTML body. */
  readonly html: string;
  /** Content-Type header value. */
  readonly contentType: string;
}

/** A link extracted from page content. */
export interface ExtractedLink {
  readonly text: string;
  readonly href: string;
}

/** Structured output returned by the web_fetch tool. */
export interface WebFetchResult {
  /** Final URL after redirects. */
  readonly url: string;
  /** Page title (from readability or <title> fallback). */
  readonly title: string;
  /** Short excerpt/description. */
  readonly excerpt: string;
  /** Author byline (if detected). */
  readonly byline: string;
  /** Site name (if detected). */
  readonly siteName: string;
  /** Markdown body content. */
  readonly content: string;
  /** Extracted links (when requested). */
  readonly links?: readonly ExtractedLink[];
}

/** Adapter interface for fetching HTML. Extensible for future backends. */
export interface FetchAdapter {
  fetch(url: string, options?: FetchOptions): Promise<FetchResult>;
}
