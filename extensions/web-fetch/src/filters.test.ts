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
});
