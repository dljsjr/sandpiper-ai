import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountPromptMarkdownEditor } from './prompt-markdown.js';
import { installBrowser } from './test-helpers.js';

afterEach(() => {
  vi.unstubAllGlobals();
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
