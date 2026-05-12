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

export interface DocumentMetadata {
  readonly title: string;
  readonly excerpt: string;
  readonly byline: string;
  readonly siteName: string;
}

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

function createDom(html: string, url: string): JSDOM {
  return new JSDOM(html, {
    url,
    // Security: do not execute scripts or fetch remote resources
    runScripts: undefined,
    resources: undefined,
    pretendToBeVisual: false,
  });
}

function metaContent(document: Document, selector: string): string {
  return document.querySelector(selector)?.getAttribute('content')?.trim() ?? '';
}

export function extractDocumentMetadata(html: string, url: string): DocumentMetadata {
  const dom = createDom(html, url);
  const { document } = dom.window;

  return {
    title: document.title.trim(),
    excerpt:
      metaContent(document, 'meta[name="description"]') || metaContent(document, 'meta[property="og:description"]'),
    byline: metaContent(document, 'meta[name="author"]'),
    siteName: metaContent(document, 'meta[property="og:site_name"]'),
  };
}

export function extractLinksFromHtml(html: string, url: string): readonly ExtractedLink[] {
  const dom = new JSDOM(html, { url });
  const anchors = dom.window.document.querySelectorAll('a[href]');
  const links: ExtractedLink[] = [];
  for (const a of anchors) {
    const href = a.getAttribute('href');
    const text = a.textContent?.trim();
    if (href && text) {
      links.push({ text, href });
    }
  }

  return links;
}

export function extractLinksFromMarkdown(markdown: string): readonly ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const linkPattern = /(?<!!)\[([^\]\n]+)]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

  for (const match of markdown.matchAll(linkPattern)) {
    const [, text, href] = match;
    if (text && href) links.push({ text, href });
  }

  return links;
}

/**
 * Extract the main article content from raw HTML.
 * Returns null if readability cannot identify article content
 * (e.g., the page is not an article-like document).
 */
export function extractContent(html: string, url: string): ExtractedContent | null {
  const dom = createDom(html, url);

  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article?.content) {
    return null;
  }

  return {
    title: article.title ?? '',
    excerpt: article.excerpt ?? '',
    byline: article.byline ?? '',
    siteName: article.siteName ?? '',
    html: article.content,
    links: extractLinksFromHtml(article.content, url),
  };
}
