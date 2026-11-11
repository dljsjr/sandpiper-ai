import { JSDOM } from 'jsdom';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { toString as nodeText } from 'mdast-util-to-string';
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

export type WebFetchFilter = HtmlFilterObject | MarkdownFilterObject;

function stripMarkdownLinks(text: string): string {
  return text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
}

function normalizeHeadingText(text: string): string {
  return stripMarkdownLinks(text)
    .replace(/`([^`]*)`/g, '$1')
    .replace(/[\\*_~[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();
}

const WORD_CHARACTER = /[\p{L}\p{N}]/u;

/** True when `phrase` occurs in `text` without a letter or digit directly before or after it. */
function containsPhrase(text: string, phrase: string): boolean {
  if (phrase === '') return false;

  for (let at = text.indexOf(phrase); at !== -1; at = text.indexOf(phrase, at + 1)) {
    const before = text[at - 1];
    const after = text[at + phrase.length];
    const bounded = (character: string | undefined) => character === undefined || !WORD_CHARACTER.test(character);
    if (bounded(before) && bounded(after)) return true;
  }

  return false;
}

interface MarkdownHeading {
  readonly depth: number;
  readonly text: string;
  /** Offset of the heading's first character in the source text. */
  readonly start: number;
}

/** Headings at the top level of the document, in source order. */
function collectMarkdownHeadings(markdown: MarkdownDocument): readonly MarkdownHeading[] {
  return fromMarkdown(markdown).children.flatMap((node) => {
    const start = node.position?.start.offset;
    if (node.type !== 'heading' || start === undefined) return [];
    return [{ depth: node.depth, text: nodeText(node), start }];
  });
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
    const headings = collectMarkdownHeadings(markdown);
    const target = normalizeHeadingText(this.heading);
    const candidates = headings
      .map((heading, index) => ({ ...heading, index, text: normalizeHeadingText(heading.text) }))
      .filter((heading) => this.level === undefined || heading.depth === this.level);
    const exact = candidates.filter((heading) => heading.text === target);
    const matches = exact.length > 0 ? exact : candidates.filter((heading) => containsPhrase(heading.text, target));

    // Slice the source instead of serializing the tree, so each section keeps the author's formatting.
    const sections = matches.map((heading) => {
      const end = headings.slice(heading.index + 1).find((candidate) => candidate.depth <= heading.depth)?.start;
      return markdown.slice(heading.start, end).trim();
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
