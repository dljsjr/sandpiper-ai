import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildMarkdownPresentation, createPromptMarkdownState, mountPromptMarkdownEditor } from './prompt-markdown.js';
import { installBrowser } from './test-helpers.js';

function hiddenText(doc: string, ranges: ReadonlyArray<{ from: number; to: number }>): string[] {
  return ranges.map(({ from, to }) => doc.slice(from, to));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('prompt Markdown presentation', () => {
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
    const state = createPromptMarkdownState(doc, doc.indexOf('literal'));

    const presentation = buildMarkdownPresentation(state, true);

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

  it('hides inline formatting markers except around the active construct', () => {
    const doc = '**bold** and *italic*';
    const inactive = buildMarkdownPresentation(createPromptMarkdownState(doc, doc.indexOf('and')), true);
    const activeBold = buildMarkdownPresentation(createPromptMarkdownState(doc, doc.indexOf('bold') + 1), true);

    expect(hiddenText(doc, inactive.hiddenMarkers)).toEqual(['**', '**', '*', '*']);
    expect(hiddenText(doc, activeBold.hiddenMarkers)).toEqual(['*', '*']);
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

    const outside = buildMarkdownPresentation(createPromptMarkdownState(doc, 0), true);
    const inside = buildMarkdownPresentation(createPromptMarkdownState(doc, doc.indexOf('one')), true);

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

    const outside = buildMarkdownPresentation(createPromptMarkdownState(doc, 0), true);
    const inside = buildMarkdownPresentation(createPromptMarkdownState(doc, doc.indexOf('policy') + 1), true);

    expect(hiddenText(doc, outside.hiddenMarkers)).toEqual(['[', ']', '(', 'https://example.com/policy', ')']);
    expect(inside.hiddenMarkers).toEqual([]);
  });
});

describe('mountPromptMarkdownEditor', () => {
  it('mounts a framework-free editor and reports exact source changes', async () => {
    const browser = installBrowser();
    const browserParent = browser.document.createElement('div');
    browser.document.body.appendChild(browserParent);
    const parent = browserParent as unknown as HTMLElement;
    const changes: string[] = [];

    const editor = mountPromptMarkdownEditor(parent, {
      doc: '# Rule\n\nKeep **exact** source.',
      onChange: (value) => changes.push(value),
      onSave: () => undefined,
    });

    expect(parent.querySelector('.cm-live-heading-line')).not.toBeNull();
    expect(parent.querySelector('.cm-live-strong')?.textContent).toBe('exact');
    editor.setValue('# Rule\n\nKeep **precise** source.');

    expect(parent.querySelector('.cm-editor')).not.toBeNull();
    expect(editor.value()).toBe('# Rule\n\nKeep **precise** source.');
    expect(changes).toEqual(['# Rule\n\nKeep **precise** source.']);

    editor.destroy();
    expect(parent.querySelector('.cm-editor')).toBeNull();
    await browser.happyDOM.close();
  });

  it('renders table previews without changing their Markdown source', async () => {
    const browser = installBrowser();
    const browserParent = browser.document.createElement('div');
    browser.document.body.appendChild(browserParent);
    const parent = browserParent as unknown as HTMLElement;
    const source = '| Name | Meaning |\n| :--- | ---: |\n| one | **first** |';

    const editor = mountPromptMarkdownEditor(parent, {
      doc: source,
      onChange: () => undefined,
      onSave: () => undefined,
    });

    const table = parent.querySelector('.cm-live-table-widget');
    expect(table).not.toBeNull();
    expect(table?.querySelectorAll('th')).toHaveLength(2);
    expect(table?.querySelector('strong')?.textContent).toBe('first');
    expect(editor.value()).toBe(source);
    editor.destroy();
    await browser.happyDOM.close();
  });
});
