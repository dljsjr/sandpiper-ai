/**
 * Content extraction using @mozilla/readability + jsdom.
 * Framework-independent — no pi imports.
 *
 * jsdom is configured with no JS execution and no remote resource
 * fetching — we are a parser, not a browser.
 */

import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import type { ExtractedLink } from './types.js';

/** Result of content extraction. */
export interface ExtractedContent {
  readonly title: string;
  readonly excerpt: string;
  readonly byline: string;
  readonly siteName: string;
  /** Cleaned HTML content (ready for markdown conversion). */
  readonly html: string;
  /** Extracted links from the article content. */
  readonly links: readonly ExtractedLink[];
}

/**
 * Extract the main article content from raw HTML.
 * Returns null if readability cannot identify article content
 * (e.g., the page is not an article-like document).
 */
export function extractContent(html: string, url: string): ExtractedContent | null {
  const dom = new JSDOM(html, {
    url,
    // Security: do not execute scripts or fetch remote resources
    runScripts: undefined,
    resources: undefined,
    pretendToBeVisual: false,
  });

  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article?.content) {
    return null;
  }

  // Extract links from the cleaned article HTML
  const articleDom = new JSDOM(article.content, { url });
  const anchors = articleDom.window.document.querySelectorAll('a[href]');
  const links: ExtractedLink[] = [];
  for (const a of anchors) {
    const href = a.getAttribute('href');
    const text = a.textContent?.trim();
    if (href && text) {
      links.push({ text, href });
    }
  }

  return {
    title: article.title ?? '',
    excerpt: article.excerpt ?? '',
    byline: article.byline ?? '',
    siteName: article.siteName ?? '',
    html: article.content,
    links,
  };
}
