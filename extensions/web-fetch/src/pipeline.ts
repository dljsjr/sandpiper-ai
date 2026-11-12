/**
 * End-to-end pipeline: fetch → extract → convert.
 * Framework-independent — no pi imports.
 */

import { htmlToMarkdown } from './convert.js';
import { extractContent, extractDocumentMetadata, extractLinksFromHtml, extractLinksFromMarkdown } from './extract.js';
import {
  createWebFetchFilter,
  type HtmlFilterObject,
  type MarkdownFilterObject,
  type WebFetchFilter,
} from './filters.js';
import {
  findLlmsTxtLink,
  findMarkdownAlternate,
  type LinkRelation,
  parseHtmlLinks,
  parseLinkHeader,
} from './link-relations.js';
import { declaredLlmsTxt, discoverLlmsTxt } from './llms-txt.js';
import { isMarkdownMediaType } from './media-types.js';
import {
  type FetchAdapter,
  type FetchResult,
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
  /** The adapter renders the page in a browser. Keep that page: do not swap in the site's Markdown version. */
  readonly render?: boolean;
  /** Aborting it stops the page requests. */
  readonly signal?: AbortSignal;
  /** Override llms.txt discovery for tests or specialized callers. */
  readonly probeLlmsTxt?: (url: string) => Promise<LlmsTxtProbeResult>;
}

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

function declaredRelations(fetchResult: FetchResult, isText: boolean): readonly LinkRelation[] {
  if (fetchResult.statusCode >= 400) return [];

  return [
    ...parseLinkHeader(fetchResult.linkHeader, fetchResult.url),
    ...(isText ? [] : parseHtmlLinks(fetchResult.body, fetchResult.url)),
  ];
}

// A body that is already text. Parsing it as HTML would collapse its line structure.
function isTextResponse(fetchResult: FetchResult): boolean {
  return isMarkdownMediaType(fetchResult.contentType);
}

/** The Markdown version a page advertises, or nothing when it cannot be fetched as text. */
async function fetchMarkdownAlternate(
  adapter: FetchAdapter,
  url: string,
  signal: AbortSignal | undefined,
): Promise<FetchResult | undefined> {
  try {
    const alternate = await adapter.fetch(url, { signal });
    return alternate.statusCode < 400 && isTextResponse(alternate) ? alternate : undefined;
  } catch {
    return undefined;
  }
}

/** Finish a result whose content is already Markdown text. */
async function markdownTextResult(
  result: WebFetchResult,
  filter: WebFetchFilter | undefined,
  options: PipelineOptions | undefined,
): Promise<WebFetchResult> {
  if (filter?.stage === 'markdown' && options?.filter) {
    return applyMarkdownFilter(result.content, result, filter, options.filter, options);
  }

  return options?.followLinks ? { ...result, links: extractLinksFromMarkdown(result.content) } : result;
}

/**
 * Fetch a URL and return structured content with a markdown body.
 */
export async function fetchAndExtract(
  adapter: FetchAdapter,
  url: string,
  options?: PipelineOptions,
): Promise<WebFetchResult> {
  const discover = options?.probeLlmsTxt ?? discoverLlmsTxt;
  const filter = createWebFetchFilter(options?.filter);
  const needsHtml = filter?.stage === 'html' || options?.render === true;
  // Start discovery with the page request, so the page rarely waits for it.
  const earlyDiscovery = discover(url);
  const fetchResult = await adapter.fetch(url, { htmlOnly: needsHtml, signal: options?.signal });
  const isText = isTextResponse(fetchResult);
  const relations = declaredRelations(fetchResult, isText);
  const declared = findLlmsTxtLink(relations);
  const alternateUrl = isText || needsHtml ? undefined : findMarkdownAlternate(relations, fetchResult.url);
  const [llmsTxt, alternate] = await Promise.all([
    declared !== undefined
      ? declaredLlmsTxt(declared)
      : fetchResult.url === url
        ? earlyDiscovery
        : discover(fetchResult.url),
    alternateUrl === undefined ? undefined : fetchMarkdownAlternate(adapter, alternateUrl, options?.signal),
  ]);
  // The Markdown version request turns its failures into a fallback to the page, an abort included.
  options?.signal?.throwIfAborted();

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

  if (isText) {
    const result = {
      url: fetchResult.url,
      title: '',
      excerpt: '',
      byline: '',
      siteName: '',
      content: fetchResult.body,
      llmsTxt,
    };
    if (filter?.stage === 'html' && options?.filter) {
      const error = `the response is ${fetchResult.contentType}, not HTML`;
      return {
        ...result,
        content: filterErrorMessage(options.filter, error),
        filter: { type: filter.type, matched: false, matchCount: 0, error },
      };
    }

    return markdownTextResult(result, filter, options);
  }

  if (alternate) {
    const metadata = extractDocumentMetadata(fetchResult.body, fetchResult.url);
    return markdownTextResult(
      { url: fetchResult.url, ...metadata, content: alternate.body, llmsTxt, markdownSource: alternate.url },
      filter,
      options,
    );
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
