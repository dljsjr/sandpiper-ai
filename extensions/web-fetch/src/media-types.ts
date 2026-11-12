/**
 * Media types the pipeline reads as Markdown text.
 * Framework-independent — no pi imports.
 */

// text/plain is included because servers send llms.txt and raw .md files as plain text.
const MARKDOWN_MEDIA_TYPES = new Set(['text/markdown', 'text/x-markdown', 'text/plain']);

/** The lowercase media type of a Content-Type header value, without its parameters. */
export function mediaType(contentType: string | null | undefined): string | undefined {
  return contentType?.split(';')[0]?.trim().toLowerCase() || undefined;
}

export function isMarkdownMediaType(type: string | undefined): boolean {
  return type !== undefined && MARKDOWN_MEDIA_TYPES.has(type);
}
