import { describe, expect, it } from 'vitest';
import { createWebFetchFilter, type MarkdownFilterObject } from './filters.js';
import { WebFetchFilterType } from './types.js';

function createMarkdownSectionFilter(heading: string, level?: number): MarkdownFilterObject {
  const filter = createWebFetchFilter({ type: WebFetchFilterType.MarkdownSection, heading, level });
  if (filter?.stage !== 'markdown') throw new Error('expected markdown filter');
  return filter;
}

describe('Markdown section filters', () => {
  it('should ignore headings inside fenced code blocks', () => {
    const filter = createMarkdownSectionFilter('Not a Section');

    const result = filter.filterMarkdown(
      ['# Page', '', '```sh', '# Not a Section', 'echo ignored', '```', '', '## Real Section', 'Body'].join('\n'),
      { url: 'https://example.com' },
    );

    expect(result).toEqual({
      content: '',
      details: { type: WebFetchFilterType.MarkdownSection, matched: false, matchCount: 0 },
    });
  });

  it('should use heading level to disambiguate repeated headings', () => {
    const filter = createMarkdownSectionFilter('Install', 3);

    const result = filter.filterMarkdown(
      [
        '# Page',
        '',
        '## Install',
        'Top-level install.',
        '',
        '### Install',
        'Nested install.',
        '',
        '## Next',
        'Done.',
      ].join('\n'),
      { url: 'https://example.com' },
    );

    expect(result).toEqual({
      content: '### Install\nNested install.',
      details: { type: WebFetchFilterType.MarkdownSection, matched: true, matchCount: 1 },
    });
  });

  it('should find sections under setext headings', () => {
    const filter = createMarkdownSectionFilter('Install');

    const result = filter.filterMarkdown(
      [
        'Title',
        '=====',
        '',
        'Intro.',
        '',
        'Install',
        '-------',
        '',
        'Run it.',
        '',
        'Usage',
        '-----',
        '',
        'Use it.',
      ].join('\n'),
      { url: 'https://example.com' },
    );

    expect(result).toEqual({
      content: 'Install\n-------\n\nRun it.',
      details: { type: WebFetchFilterType.MarkdownSection, matched: true, matchCount: 1 },
    });
  });

  it.each([
    ['resolved reference links', ['', '[0.80.10]: https://example.com/a', '[0.80.1]: https://example.com/b']],
    ['literal brackets', []],
  ])('should match a heading that contains the requested text as a whole phrase (%s)', async (_name, definitions) => {
    const filter = createMarkdownSectionFilter('0.80.1');

    const result = await filter.filterMarkdown(
      [
        '# Changelog',
        '',
        '## [0.80.10] - 2026-07-01',
        'Later release.',
        '',
        '## [0.80.1] - 2026-06-23',
        'Wanted release.',
        ...definitions,
      ].join('\n'),
      { url: 'https://example.com' },
    );

    expect(result.content.split('\n').slice(0, 2)).toEqual(['## [0.80.1] - 2026-06-23', 'Wanted release.']);
    expect(result.content).not.toContain('Later release.');
    expect(result.details).toEqual({ type: WebFetchFilterType.MarkdownSection, matched: true, matchCount: 1 });
  });

  it('should prefer an exact heading match over a phrase match', () => {
    const filter = createMarkdownSectionFilter('Install');

    const result = filter.filterMarkdown(
      ['## Install from source', 'Build it.', '', '## Install', 'Download it.'].join('\n'),
      { url: 'https://example.com' },
    );

    expect(result).toEqual({
      content: '## Install\nDownload it.',
      details: { type: WebFetchFilterType.MarkdownSection, matched: true, matchCount: 1 },
    });
  });

  it('should not match the requested text inside a longer word', async () => {
    const filter = createMarkdownSectionFilter('Install');

    const result = await filter.filterMarkdown(['## Installation', 'One.', '', '## Uninstall', 'Two.'].join('\n'), {
      url: 'https://example.com',
    });

    expect(result.details).toEqual({ type: WebFetchFilterType.MarkdownSection, matched: false, matchCount: 0 });
  });

  it('should keep the source formatting of a section, including CRLF line endings', async () => {
    const filter = createMarkdownSectionFilter('Two');

    const result = await filter.filterMarkdown('# One\r\n\r\nA\r\n\r\n## Two\r\n\r\n*  item\tx\r\n\r\n# Three\r\n', {
      url: 'https://example.com',
    });

    expect(result.content).toBe('## Two\r\n\r\n*  item\tx');
  });
});
