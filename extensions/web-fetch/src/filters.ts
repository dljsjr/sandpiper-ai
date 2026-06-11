import { JSDOM } from 'jsdom';
import type { WebFetchFilterDetails, WebFetchFilterSpec, WebFetchFilterType } from './types.js';

export type HtmlDocument = string;
export type MarkdownDocument = string;

export interface WebFetchFilterContext {
  readonly url: string;
}

export interface WebFetchFilterResult<TContent> {
  readonly content: TContent;
  readonly details: WebFetchFilterDetails;
}

export interface HtmlFilterObject {
  readonly stage: 'html';
  readonly type: WebFetchFilterType;
  filterHtml(
    html: HtmlDocument,
    context: WebFetchFilterContext,
  ): WebFetchFilterResult<HtmlDocument> | Promise<WebFetchFilterResult<HtmlDocument>>;
}

export interface MarkdownFilterObject {
  readonly stage: 'markdown';
  readonly type: WebFetchFilterType;
  filterMarkdown(
    markdown: MarkdownDocument,
    context: WebFetchFilterContext,
  ): WebFetchFilterResult<MarkdownDocument> | Promise<WebFetchFilterResult<MarkdownDocument>>;
}

export type HtmlFilterFunc = (
  html: HtmlDocument,
  context: WebFetchFilterContext,
) => HtmlDocument | Promise<HtmlDocument>;

export type MarkdownFilterFunc = (
  markdown: MarkdownDocument,
  context: WebFetchFilterContext,
) => MarkdownDocument | Promise<MarkdownDocument>;

export type WebFetchFilter = HtmlFilterObject | MarkdownFilterObject;

function stripMarkdownLinks(text: string): string {
  return text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
}

function normalizeHeadingText(text: string): string {
  return stripMarkdownLinks(text)
    .replace(/`([^`]*)`/g, '$1')
    .replace(/[\\*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();
}

function parseMarkdownHeading(line: string): { readonly level: number; readonly text: string } | undefined {
  const match = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/.exec(line);
  if (!match) return undefined;

  const marker = match[1];
  const text = match[2];
  if (!marker || !text) return undefined;

  return { level: marker.length, text: text.trim() };
}

function collectMarkdownHeadings(markdown: MarkdownDocument): readonly {
  readonly lineIndex: number;
  readonly level: number;
  readonly text: string;
}[] {
  const lines = markdown.split(/\r?\n/);
  const headings: { lineIndex: number; level: number; text: string }[] = [];
  let fence: { marker: '`' | '~'; length: number } | undefined;

  lines.forEach((line, lineIndex) => {
    const fenceMatch = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      const fenceMarker = fenceMatch[1];
      if (!fenceMarker) return;
      const marker = fenceMarker[0] as '`' | '~';
      const length = fenceMarker.length;
      if (!fence) {
        fence = { marker, length };
      } else if (marker === fence.marker && length >= fence.length) {
        fence = undefined;
      }
      return;
    }

    if (fence) return;

    const heading = parseMarkdownHeading(line);
    if (heading) headings.push({ lineIndex, ...heading });
  });

  return headings;
}

class CssSelectorFilter implements HtmlFilterObject {
  readonly stage = 'html';
  readonly type: WebFetchFilterType;

  constructor(
    type: WebFetchFilterType,
    private readonly selector: string,
  ) {
    this.type = type;
  }

  filterHtml(html: HtmlDocument, context: WebFetchFilterContext): WebFetchFilterResult<HtmlDocument> {
    const dom = new JSDOM(html, {
      url: context.url,
      runScripts: undefined,
      resources: undefined,
      pretendToBeVisual: false,
    });

    try {
      const matches = Array.from(dom.window.document.querySelectorAll(this.selector));
      return {
        content: matches.map((element) => element.outerHTML).join('\n'),
        details: {
          type: this.type,
          matched: matches.length > 0,
          matchCount: matches.length,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: '',
        details: {
          type: this.type,
          matched: false,
          matchCount: 0,
          error: message,
        },
      };
    }
  }
}

class MarkdownSectionFilter implements MarkdownFilterObject {
  readonly stage = 'markdown';
  readonly type: WebFetchFilterType;

  constructor(
    type: WebFetchFilterType,
    private readonly heading: string,
    private readonly level?: number,
  ) {
    this.type = type;
  }

  filterMarkdown(markdown: MarkdownDocument): WebFetchFilterResult<MarkdownDocument> {
    const lines = markdown.split(/\r?\n/);
    const headings = collectMarkdownHeadings(markdown);
    const target = normalizeHeadingText(this.heading);
    const sections: string[] = [];

    headings.forEach((heading, index) => {
      if (this.level !== undefined && heading.level !== this.level) return;
      if (normalizeHeadingText(heading.text) !== target) return;

      const nextBoundary = headings.slice(index + 1).find((candidate) => candidate.level <= heading.level)?.lineIndex;
      sections.push(lines.slice(heading.lineIndex, nextBoundary).join('\n').trim());
    });

    return {
      content: sections.join('\n\n').trim(),
      details: {
        type: this.type,
        matched: sections.length > 0,
        matchCount: sections.length,
      },
    };
  }
}

export function createWebFetchFilter(spec: WebFetchFilterSpec | undefined): WebFetchFilter | undefined {
  if (!spec) return undefined;

  switch (spec.type) {
    case 'css_selector':
      return new CssSelectorFilter(spec.type, spec.selector);
    case 'markdown_section':
      return new MarkdownSectionFilter(spec.type, spec.heading, spec.level);
  }
}
