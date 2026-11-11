/**
 * End-to-end pipeline: fetch → extract → convert.
 * Framework-independent — no pi imports.
 */

import { htmlToMarkdown } from './convert.js';
import { extractContent, extractDocumentMetadata, extractLinksFromHtml, extractLinksFromMarkdown } from './extract.js';
import { createWebFetchFilter, type HtmlFilterObject, type MarkdownFilterObject } from './filters.js';
import { probeLlmsTxt } from './llms-txt.js';
import {
  type FetchAdapter,
  type LlmsTxtProbeResult,
  type WebFetchFilterSpec,
  WebFetchFilterType,
  type WebFetchResult,
} from './types.js';

export interface PipelineOptions {
  /** Targeted extraction filter. */
  readonly filter?: WebFetchFilterSpec;
  /** Whether to extract and return page links. */
  readonly followLinks?: boolean;
  /** Override llms.txt probing for tests or specialized callers. */
  readonly probeLlmsTxt?: (url: string) => Promise<LlmsTxtProbeResult>;
}

// Bodies that are already text. Parsing them as HTML would collapse their line structure.
const TEXT_MEDIA_TYPES = new Set(['text/markdown', 'text/x-markdown', 'text/plain']);

function noMatchMessage(filter: WebFetchFilterSpec): string {
  switch (filter.type) {
    case WebFetchFilterType.CssSelector:
      return `No content matched CSS selector: ${filter.selector}`;
    case WebFetchFilterType.MarkdownSection:
      return `No content matched Markdown section: ${filter.heading}`;
  }
}

function filterErrorMessage(filter: WebFetchFilterSpec, error: string): string {
  switch (filter.type) {
    case WebFetchFilterType.CssSelector:
      return `CSS selector filter failed: ${error}`;
    case WebFetchFilterType.MarkdownSection:
      return `Markdown section filter failed: ${error}`;
  }
}

async function applyMarkdownFilter(
  markdown: string,
  result: WebFetchResult,
  filter: MarkdownFilterObject,
  filterSpec: WebFetchFilterSpec,
  options?: PipelineOptions,
): Promise<WebFetchResult> {
  const filtered = await filter.filterMarkdown(markdown, { url: result.url });
  const content = filtered.details.matched ? filtered.content : noMatchMessage(filterSpec);
  const filteredResult = {
    ...result,
    content,
    filter: filtered.details,
  };

  if (options?.followLinks) {
    return { ...filteredResult, links: filtered.details.matched ? extractLinksFromMarkdown(content) : [] };
  }

  return filteredResult;
}

async function applyHtmlFilter(
  html: string,
  url: string,
  filter: HtmlFilterObject,
  filterSpec: WebFetchFilterSpec,
  llmsTxt: LlmsTxtProbeResult,
  options?: PipelineOptions,
): Promise<WebFetchResult> {
  const metadata = extractDocumentMetadata(html, url);
  const filtered = await filter.filterHtml(html, { url });

  if (!filtered.details.matched) {
    return {
      url,
      title: metadata.title,
      excerpt: metadata.excerpt,
      byline: metadata.byline,
      siteName: metadata.siteName,
      content: filtered.details.error
        ? filterErrorMessage(filterSpec, filtered.details.error)
        : noMatchMessage(filterSpec),
      llmsTxt,
      filter: filtered.details,
    };
  }

  return {
    url,
    title: metadata.title,
    excerpt: metadata.excerpt,
    byline: metadata.byline,
    siteName: metadata.siteName,
    content: htmlToMarkdown(filtered.content),
    llmsTxt,
    filter: filtered.details,
    ...(options?.followLinks ? { links: extractLinksFromHtml(filtered.content, url) } : {}),
  };
}

/**
 * Fetch a URL and return structured content with a markdown body.
 */
export async function fetchAndExtract(
  adapter: FetchAdapter,
  url: string,
  options?: PipelineOptions,
): Promise<WebFetchResult> {
  const fetchResult = await adapter.fetch(url);
  const llmsTxt = await (options?.probeLlmsTxt ?? probeLlmsTxt)(fetchResult.url);
  const filter = createWebFetchFilter(options?.filter);

  if (fetchResult.statusCode >= 400) {
    return {
      url: fetchResult.url,
      title: '',
      excerpt: '',
      byline: '',
      siteName: '',
      content: `HTTP error: ${fetchResult.statusCode}`,
      llmsTxt,
    };
  }

  if (fetchResult.contentType !== undefined && TEXT_MEDIA_TYPES.has(fetchResult.contentType)) {
    const result = {
      url: fetchResult.url,
      title: '',
      excerpt: '',
      byline: '',
      siteName: '',
      content: fetchResult.body,
      llmsTxt,
    };
    if (filter?.stage === 'markdown' && options?.filter) {
      return applyMarkdownFilter(fetchResult.body, result, filter, options.filter, options);
    }
    if (filter?.stage === 'html' && options?.filter) {
      const error = `the response is ${fetchResult.contentType}, not HTML`;
      return {
        ...result,
        content: filterErrorMessage(options.filter, error),
        filter: { type: filter.type, matched: false, matchCount: 0, error },
      };
    }

    return options?.followLinks ? { ...result, links: extractLinksFromMarkdown(fetchResult.body) } : result;
  }

  if (filter?.stage === 'html' && options?.filter) {
    return applyHtmlFilter(fetchResult.body, fetchResult.url, filter, options.filter, llmsTxt, options);
  }

  const extracted = extractContent(fetchResult.body, fetchResult.url);

  if (!extracted) {
    // Readability couldn't parse — fall back to raw HTML conversion
    const markdown = htmlToMarkdown(fetchResult.body);
    const result = {
      url: fetchResult.url,
      title: '',
      excerpt: '',
      byline: '',
      siteName: '',
      content: markdown,
      llmsTxt,
    };
    if (filter?.stage === 'markdown' && options?.filter) {
      return applyMarkdownFilter(markdown, result, filter, options.filter, options);
    }

    return result;
  }

  const markdown = htmlToMarkdown(extracted.html);

  const result = {
    url: fetchResult.url,
    title: extracted.title,
    excerpt: extracted.excerpt,
    byline: extracted.byline,
    siteName: extracted.siteName,
    content: markdown,
    llmsTxt,
    ...(options?.followLinks ? { links: extracted.links } : {}),
  };
  if (filter?.stage === 'markdown' && options?.filter) {
    return applyMarkdownFilter(markdown, result, filter, options.filter, options);
  }

  return result;
}
