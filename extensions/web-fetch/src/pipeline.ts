/**
 * End-to-end pipeline: fetch → extract → convert.
 * Framework-independent — no pi imports.
 */

import { htmlToMarkdown } from './convert.js';
import { extractContent } from './extract.js';
import type { FetchAdapter, FetchOptions, WebFetchResult } from './types.js';

export interface PipelineOptions extends FetchOptions {
  /** CSS selector to extract specific content (not yet implemented). */
  readonly selector?: string;
  /** Whether to extract and return page links. */
  readonly followLinks?: boolean;
}

/**
 * Fetch a URL and return structured content with a markdown body.
 */
export async function fetchAndExtract(
  adapter: FetchAdapter,
  url: string,
  options?: PipelineOptions,
): Promise<WebFetchResult> {
  const fetchResult = await adapter.fetch(url, options);

  if (fetchResult.statusCode >= 400) {
    return {
      url: fetchResult.url,
      title: '',
      excerpt: '',
      byline: '',
      siteName: '',
      content: `HTTP error: ${fetchResult.statusCode}`,
    };
  }

  const extracted = extractContent(fetchResult.html, fetchResult.url);

  if (!extracted) {
    // Readability couldn't parse — fall back to raw HTML conversion
    const markdown = htmlToMarkdown(fetchResult.html);
    return {
      url: fetchResult.url,
      title: '',
      excerpt: '',
      byline: '',
      siteName: '',
      content: markdown,
    };
  }

  const markdown = htmlToMarkdown(extracted.html);

  return {
    url: fetchResult.url,
    title: extracted.title,
    excerpt: extracted.excerpt,
    byline: extracted.byline,
    siteName: extracted.siteName,
    content: markdown,
    ...(options?.followLinks ? { links: extracted.links } : {}),
  };
}
