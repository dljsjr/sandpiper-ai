/**
 * Core types for the web-fetch extension.
 * Framework-independent — no pi imports.
 */

/** Raw result from the fetch adapter (before content extraction). */
export interface FetchResult {
  /** Final URL after redirects. */
  readonly url: string;
  /** HTTP status code. */
  readonly statusCode: number;
  /** Raw response body: HTML, or text when `contentType` says so. */
  readonly body: string;
  /** Lowercase media type from the Content-Type header, without parameters. Absent when the server sent none. */
  readonly contentType?: string;
  /** Raw Link header value. Absent when the server sent none. */
  readonly linkHeader?: string;
}

/** A link extracted from page content. */
export interface ExtractedLink {
  readonly text: string;
  readonly href: string;
}

/** Supported targeted extraction filter kinds. */
export enum WebFetchFilterType {
  CssSelector = 'css_selector',
  MarkdownSection = 'markdown_section',
}

/** Extract content from HTML elements matching a CSS selector. */
export interface CssSelectorFilterSpec {
  readonly type: WebFetchFilterType.CssSelector;
  readonly selector: string;
}

/** Extract content from a Markdown heading section. */
export interface MarkdownSectionFilterSpec {
  readonly type: WebFetchFilterType.MarkdownSection;
  readonly heading: string;
  readonly level?: number;
}

/** Declarative filter specs accepted by the web_fetch tool. */
export type WebFetchFilterSpec = CssSelectorFilterSpec | MarkdownSectionFilterSpec;

/** Structured metadata about an applied targeted extraction filter. */
export interface WebFetchFilterDetails {
  readonly type: WebFetchFilterType;
  readonly matched: boolean;
  readonly matchCount: number;
  readonly error?: string;
}

/** Structured output returned by the web_fetch tool. */
export type LlmsTxtProbeStatus = 'found' | 'missing' | 'unknown';

/** Supplemental llms.txt existence probe metadata. */
export interface LlmsTxtProbeResult {
  /** Whether a probe was attempted. */
  readonly checked: boolean;
  /** True when llms.txt exists, false when confidently missing, null when indeterminate. */
  readonly exists: boolean | null;
  /** Coarse result status for consumers that prefer strings over nullable booleans. */
  readonly status: LlmsTxtProbeStatus;
  /** URL that was probed or would have been probed. */
  readonly url: string;
  /** Timestamp for the cached probe outcome. */
  readonly checkedAt: string;
  /** HTTP status returned by the probe when available. */
  readonly statusCode?: number;
  /** Why the outcome is unknown, or missing despite a success status. */
  readonly reason?: string;
  /** Allow header for 405 Method Not Allowed responses. */
  readonly allow?: string;
}

/** A link from the fetched page to another resource. */
export interface PageLink {
  readonly url: string;
  /** The link's title, with its whitespace collapsed. */
  readonly title?: string;
}

/** The links a page declares that lead an agent to more information. Each is absent when not declared. */
export interface PageLinks {
  readonly canonical?: PageLink;
  readonly latestVersion?: PageLink;
  readonly prev?: PageLink;
  readonly next?: PageLink;
  readonly up?: PageLink;
  readonly agentSkills?: PageLink;
}

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
  /** URL of the site's own Markdown version of the page, when the content came from it. */
  readonly markdownSource?: string;
  /** Supplemental llms.txt existence probe metadata. */
  readonly llmsTxt?: LlmsTxtProbeResult;
  /** Links the page declares to related resources, when it declares any. */
  readonly pageLinks?: PageLinks;
  /** Targeted extraction filter metadata, when a filter was applied. */
  readonly filter?: WebFetchFilterDetails;
  /** Extracted links (when requested). */
  readonly links?: readonly ExtractedLink[];
}

export interface FetchOptions {
  /** Ask for HTML only. By default the adapter asks for a Markdown version first. */
  readonly htmlOnly?: boolean;
  /** Aborting it stops the request. */
  readonly signal?: AbortSignal;
}

/** Adapter interface for fetching a page. Extensible for future backends. */
export interface FetchAdapter {
  fetch(url: string, options?: FetchOptions): Promise<FetchResult>;
}
