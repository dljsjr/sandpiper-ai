import { markdownLanguage } from '@codemirror/lang-markdown';
import { describe, expect, it } from 'vitest';
import {
  buildMarkdownPresentation,
  type MarkdownPresentation,
  type MarkdownRange,
  parseInlineMarkdown,
} from './markdown-presentation.js';

/** The presentation of `doc` with the given selection, as the editor computes it. */
function present(doc: string, selection: readonly MarkdownRange[], focused = true): MarkdownPresentation {
  return buildMarkdownPresentation(doc, markdownLanguage.parser.parse(doc), selection, focused);
}

function cursorAt(position: number): MarkdownRange[] {
  return [{ from: position, to: position }];
}

function hiddenText(doc: string, ranges: ReadonlyArray<{ from: number; to: number }>): string[] {
  return ranges.map(({ from, to }) => doc.slice(from, to));
}

describe('buildMarkdownPresentation', () => {
  it('recognizes the Markdown constructs used by prompt sources', () => {
    const doc = [
      '# Heading',
      '',
      '**strong** and *emphasis* and ~~removed~~ and `code` and [a link](https://example.com).',
      '',
      '> quoted guidance',
      '',
      '- first rule',
      '',
      '```text',
      'literal prompt text',
      '```',
      '',
      '| Name | Meaning |',
      '| :--- | ---: |',
      '| one | value |',
    ].join('\n');

    const presentation = present(doc, cursorAt(doc.indexOf('literal')));

    expect(new Set(presentation.styles.map((style) => style.kind))).toEqual(
      new Set([
        'heading-1',
        'strong',
        'emphasis',
        'strikethrough',
        'inline-code',
        'link',
        'blockquote',
        'list',
        'fenced-code',
        'table',
      ]),
    );
  });

  it('styles each line of a block from the start of the line', () => {
    const doc = ['# Title', '', '> one', '> two', '', '```', 'code', '```', '', '## Sub'].join('\n');

    const presentation = present(doc, cursorAt(0));

    expect(presentation.lines).toEqual([
      { from: 0, kind: 'heading-1' },
      { from: doc.indexOf('> one'), kind: 'blockquote' },
      { from: doc.indexOf('> two'), kind: 'blockquote' },
      { from: doc.indexOf('```'), kind: 'fenced-code' },
      { from: doc.indexOf('code\n'), kind: 'fenced-code' },
      { from: doc.lastIndexOf('```'), kind: 'fenced-code' },
      { from: doc.indexOf('## Sub'), kind: 'heading-2' },
    ]);
  });

  it('hides inline formatting markers except around the active construct', () => {
    const doc = '**bold** and *italic*';
    const inactive = present(doc, cursorAt(doc.indexOf('and')));
    const activeBold = present(doc, cursorAt(doc.indexOf('bold') + 1));

    expect(hiddenText(doc, inactive.hiddenMarkers)).toEqual(['**', '**', '*', '*']);
    expect(hiddenText(doc, activeBold.hiddenMarkers)).toEqual(['*', '*']);
  });

  it('treats a cursor at the end of a construct as outside it and a selection across it as inside', () => {
    const doc = '**bold** and *italic*';

    expect(hiddenText(doc, present(doc, cursorAt(doc.indexOf(' and'))).hiddenMarkers)).toEqual(['**', '**', '*', '*']);
    expect(hiddenText(doc, present(doc, [{ from: 6, to: 10 }]).hiddenMarkers)).toEqual(['*', '*']);
    expect(hiddenText(doc, present(doc, [{ from: 8, to: 13 }]).hiddenMarkers)).toEqual(['**', '**', '*', '*']);
  });

  it('shows heading markers only while the cursor is on the heading line', () => {
    const doc = '# Head\n\ntext';

    expect(present(doc, cursorAt(doc.indexOf('\n'))).hiddenMarkers).toEqual([]);
    expect(present(doc, cursorAt(doc.indexOf('\n') + 1)).hiddenMarkers).toEqual([{ from: 0, to: 1 }]);
  });

  it('renders a table outside the cursor and exposes its source for editing', () => {
    const doc = [
      'Intro',
      '',
      '| Name | Meaning |',
      '| :--- | ---: |',
      '| one | **first** |',
      '| two | `second` |',
    ].join('\n');

    const outside = present(doc, cursorAt(0));
    const inside = present(doc, cursorAt(doc.indexOf('one')));

    expect(outside.tables).toEqual([
      {
        from: doc.indexOf('| Name'),
        to: doc.length,
        headers: ['Name', 'Meaning'],
        alignments: ['left', 'right'],
        rows: [
          ['one', '**first**'],
          ['two', '`second`'],
        ],
      },
    ]);
    expect(inside.tables).toEqual([]);
    expect(inside.lines.some((line) => line.kind === 'table-source')).toBe(true);
  });

  it('collapses links to their labels while preserving source near the cursor', () => {
    const doc = 'Read [the policy](https://example.com/policy) before editing.';

    const outside = present(doc, cursorAt(0));
    const inside = present(doc, cursorAt(doc.indexOf('policy') + 1));

    expect(hiddenText(doc, outside.hiddenMarkers)).toEqual(['[', ']', '(', 'https://example.com/policy', ')']);
    expect(inside.hiddenMarkers).toEqual([]);
  });

  it('presents everything as preview when the editor is not focused', () => {
    const doc = '**bold**\n\n| A | B |\n| - | - |\n| 1 | 2 |';
    const unfocused = present(doc, cursorAt(doc.indexOf('bold')), false);
    const table = present(doc, cursorAt(doc.indexOf('1 |')), false);

    expect(hiddenText(doc, unfocused.hiddenMarkers)).toEqual(['**', '**']);
    expect(table.tables).toEqual([
      {
        from: doc.indexOf('| A'),
        to: doc.length,
        headers: ['A', 'B'],
        alignments: [null, null],
        rows: [['1', '2']],
      },
    ]);
    expect(table.lines).toEqual([]);
  });
});

describe('parseInlineMarkdown', () => {
  it('splits table cell text into nested inline formatting', () => {
    expect(parseInlineMarkdown('a **bold `_x_` _em_** [label](https://example.com) ~~gone~~')).toEqual([
      { kind: 'text', text: 'a ' },
      {
        kind: 'strong',
        children: [
          { kind: 'text', text: 'bold ' },
          { kind: 'code', text: '_x_' },
          { kind: 'text', text: ' ' },
          { kind: 'emphasis', children: [{ kind: 'text', text: 'em' }] },
        ],
      },
      { kind: 'text', text: ' ' },
      { kind: 'link', url: 'https://example.com', children: [{ kind: 'text', text: 'label' }] },
      { kind: 'text', text: ' ' },
      { kind: 'strikethrough', children: [{ kind: 'text', text: 'gone' }] },
    ]);
  });

  it('leaves text without formatting as one text node', () => {
    expect(parseInlineMarkdown('plain value')).toEqual([{ kind: 'text', text: 'plain value' }]);
  });
});
