import { describe, expect, it } from 'vitest';
import { findLlmsTxtLink, findMarkdownAlternate, parseHtmlLinks, parseLinkHeader } from './link-relations.js';

const PAGE = 'https://example.com/docs/guide/page.html';

describe('parseLinkHeader', () => {
  it('reads targets, relation types and media types, resolving relative targets', () => {
    expect(
      parseLinkHeader(
        '</docs/guide/page.html.md>; rel="alternate"; type="text/markdown", </docs/llms.txt>; rel="describedby"',
        PAGE,
      ),
    ).toEqual([
      { href: 'https://example.com/docs/guide/page.html.md', rel: ['alternate'], type: 'text/markdown' },
      { href: 'https://example.com/docs/llms.txt', rel: ['describedby'] },
    ]);
  });

  it('copes with unquoted values, empty values, several relation types and commas inside targets', () => {
    expect(
      parseLinkHeader(
        '</font,a.woff2>; as=font; crossorigin=; rel=preload; type=font/woff2, <https://other.example/x.md>; REL="Alternate nofollow"; TYPE="Text/Markdown"',
        PAGE,
      ),
    ).toEqual([
      { href: 'https://example.com/font,a.woff2', rel: ['preload'], type: 'font/woff2' },
      { href: 'https://other.example/x.md', rel: ['alternate', 'nofollow'], type: 'text/markdown' },
    ]);
  });

  it('returns nothing for an absent or malformed header', () => {
    expect(parseLinkHeader(undefined, PAGE)).toEqual([]);
    expect(parseLinkHeader('not a link header', PAGE)).toEqual([]);
  });
});

describe('parseHtmlLinks', () => {
  it('reads link elements from the document', () => {
    const html = `<html><head>
      <link rel="stylesheet" href="/site.css">
      <link href="/docs/guide/page.md" rel="alternate" type="text/markdown">
      <link rel="describedby" href="/llms.txt">
    </head><body><p>Body</p></body></html>`;

    expect(parseHtmlLinks(html, PAGE)).toEqual([
      { href: 'https://example.com/site.css', rel: ['stylesheet'] },
      { href: 'https://example.com/docs/guide/page.md', rel: ['alternate'], type: 'text/markdown' },
      { href: 'https://example.com/llms.txt', rel: ['describedby'] },
    ]);
  });
});

describe('findLlmsTxtLink', () => {
  it('returns the described-by target only when it names an llms.txt file', () => {
    expect(findLlmsTxtLink([{ href: 'https://example.com/docs/llms.txt', rel: ['describedby'] }])).toBe(
      'https://example.com/docs/llms.txt',
    );
    expect(findLlmsTxtLink([{ href: 'https://example.com/schema.json', rel: ['describedby'] }])).toBeUndefined();
    expect(findLlmsTxtLink([{ href: 'https://example.com/llms.txt', rel: ['alternate'] }])).toBeUndefined();
  });
});

describe('findMarkdownAlternate', () => {
  it('returns a Markdown alternate on the same origin as the page', () => {
    expect(
      findMarkdownAlternate(
        [{ href: 'https://example.com/docs/guide/page.md', rel: ['alternate'], type: 'text/markdown' }],
        PAGE,
      ),
    ).toBe('https://example.com/docs/guide/page.md');
  });

  it('ignores other origins, other media types and the page itself', () => {
    expect(
      findMarkdownAlternate(
        [
          { href: 'https://other.example/page.md', rel: ['alternate'], type: 'text/markdown' },
          { href: 'https://example.com/feed.xml', rel: ['alternate'], type: 'application/rss+xml' },
          { href: PAGE, rel: ['alternate'], type: 'text/markdown' },
        ],
        PAGE,
      ),
    ).toBeUndefined();
  });
});
