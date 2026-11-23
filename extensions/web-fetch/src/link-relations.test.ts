import { describe, expect, it } from 'vitest';
import {
  findLlmsTxtLink,
  findMarkdownAlternate,
  findPageLinks,
  parseHtmlLinks,
  parseLinkHeader,
} from './link-relations.js';

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

  it('keeps a title with its whitespace collapsed, preferring the UTF-8 title* form', () => {
    expect(
      parseLinkHeader(
        `</a.html>; rel="next"; title="Streams   and pipes", </b.html>; rel="prev"; title="Cafe"; title*=UTF-8''Caf%C3%A9`,
        PAGE,
      ),
    ).toEqual([
      { href: 'https://example.com/a.html', rel: ['next'], title: 'Streams and pipes' },
      { href: 'https://example.com/b.html', rel: ['prev'], title: 'Café' },
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
      <link rel="next" href="streams.html" title="  Streams
        and pipes ">
      <link rel="prev" href="runners.html" title=" ">
    </head><body><p>Body</p></body></html>`;

    expect(parseHtmlLinks(html, PAGE)).toEqual([
      { href: 'https://example.com/site.css', rel: ['stylesheet'] },
      { href: 'https://example.com/docs/guide/page.md', rel: ['alternate'], type: 'text/markdown' },
      { href: 'https://example.com/llms.txt', rel: ['describedby'] },
      { href: 'https://example.com/docs/guide/streams.html', rel: ['next'], title: 'Streams and pipes' },
      { href: 'https://example.com/docs/guide/runners.html', rel: ['prev'] },
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

  it('accepts an llms.txt file declared as the index', () => {
    expect(
      findLlmsTxtLink([{ href: 'https://docs.example.com/llms.txt', rel: ['index'], type: 'text/markdown' }]),
    ).toBe('https://docs.example.com/llms.txt');
    expect(findLlmsTxtLink([{ href: 'https://example.com/genindex.html', rel: ['index'] }])).toBeUndefined();
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

  it('ignores an llms.txt file offered as the Markdown version of one page', () => {
    expect(
      findMarkdownAlternate(
        [
          { href: 'https://example.com/llms-full.txt', rel: ['alternate'], type: 'text/markdown' },
          { href: 'https://example.com/docs/llms.txt', rel: ['alternate'], type: 'text/markdown' },
        ],
        PAGE,
      ),
    ).toBeUndefined();
  });
});

describe('findPageLinks', () => {
  it('picks the links that lead to more information, the first declaration of each winning', () => {
    expect(
      findPageLinks(
        [
          { href: 'https://example.com/site.css', rel: ['stylesheet'] },
          { href: 'https://docs.example.com/docs/guide/page.html', rel: ['canonical'] },
          { href: 'https://example.com/v4/guide/page.html', rel: ['latest-version'] },
          { href: 'https://example.com/docs/guide/intro.html', rel: ['previous'], title: 'Intro' },
          { href: 'https://example.com/docs/guide/next.html', rel: ['next'], title: 'Next steps' },
          { href: 'https://example.com/docs/guide/other.html', rel: ['next'] },
          { href: 'https://example.com/docs/guide/', rel: ['up'] },
          { href: 'https://example.com/.well-known/skills/index.json', rel: ['service-meta'] },
        ],
        PAGE,
      ),
    ).toEqual({
      canonical: { url: 'https://docs.example.com/docs/guide/page.html' },
      latestVersion: { url: 'https://example.com/v4/guide/page.html' },
      prev: { url: 'https://example.com/docs/guide/intro.html', title: 'Intro' },
      next: { url: 'https://example.com/docs/guide/next.html', title: 'Next steps' },
      up: { url: 'https://example.com/docs/guide/' },
      agentSkills: { url: 'https://example.com/.well-known/skills/index.json' },
    });
  });

  it('recognizes an agent skills index by its path, whatever the relation', () => {
    expect(
      findPageLinks([{ href: 'https://example.com/.well-known/agent-skills/index.json', rel: ['describedby'] }], PAGE),
    ).toEqual({ agentSkills: { url: 'https://example.com/.well-known/agent-skills/index.json' } });
  });

  it('leaves out links to the page itself and returns nothing when no link applies', () => {
    expect(
      findPageLinks(
        [
          { href: PAGE, rel: ['canonical'] },
          { href: 'https://example.com/site.css', rel: ['stylesheet'] },
        ],
        PAGE,
      ),
    ).toBeUndefined();
  });
});
