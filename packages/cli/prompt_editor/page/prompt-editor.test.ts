import { readFileSync } from 'node:fs';
import type { Window } from 'happy-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installBrowser } from './test-helpers.js';

interface PromptEditorController {
  render(payload: unknown): void;
}

interface MarkdownEditorStub {
  mount(parent: HTMLElement, options: { doc: string }): unknown;
}

const staticMarkdownEditor: MarkdownEditorStub = {
  mount(_parent, options) {
    return {
      value: () => options.doc,
      setValue: () => undefined,
      focus: () => undefined,
      destroy: () => undefined,
    };
  },
};

/** Loads the page into a happy-dom window and runs its controller script. */
function loadPromptEditor(promptMarkdown: MarkdownEditorStub = staticMarkdownEditor): {
  readonly browser: Window;
  readonly messages: unknown[];
  readonly promptEditor: PromptEditorController;
} {
  const browser = installBrowser();
  const messages: unknown[] = [];
  Object.assign(browser, {
    glimpse: {
      send: (message: unknown) => messages.push(message),
      close: () => undefined,
    },
    promptMarkdown,
  });

  const html = readFileSync(new URL('./prompt-editor.html', import.meta.url), 'utf-8');
  browser.document.write(html);
  const scriptStart = html.lastIndexOf('<script>') + '<script>'.length;
  const scriptEnd = html.lastIndexOf('</script>');
  new Function(html.slice(scriptStart, scriptEnd))();

  return {
    browser,
    messages,
    promptEditor: (browser as unknown as { promptEditor: PromptEditorController }).promptEditor,
  };
}

const emptyStage = {
  draftRevision: 0,
  pendingRegionCount: 0,
  pendingRegionIds: [],
  pendingFileCount: 0,
  previewReady: false,
  warnings: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('prompt editor page', () => {
  it('inlines no external scripts and has an insertion point for the Markdown editor bundle', () => {
    const html = readFileSync(new URL('./prompt-editor.html', import.meta.url), 'utf-8');

    expect(html).toContain('<script data-prompt-markdown-bundle></script>');
    expect(html).not.toContain('<script src=');
    expect(html).not.toMatch(/birdup/i);
  });

  it('nests editable files under the prompt section they render in', async () => {
    const { browser, promptEditor } = loadPromptEditor();
    const source = { kind: 'source', path: '/tmp/AGENTS.md', label: 'AGENTS.md', regionIds: ['source-1'], tags: [] };

    promptEditor.render({
      ...emptyStage,
      generation: 1,
      regionCount: 1,
      sources: [source],
      lockedRegions: [],
      navigation: [source],
      segments: [
        {
          editable: false,
          text: '<system_prompt>\n<rules>\nFollow these.\n',
          parts: [
            { text: '<system_prompt>', editable: false, tag: true, anchorId: 'tag-0' },
            { text: '\n', editable: false },
            { text: '<rules>', editable: false, tag: true, anchorId: 'tag-1' },
            { text: '\nFollow these.\n', editable: false },
          ],
          segmentId: 'prompt-segment-0',
        },
        {
          editable: true,
          regionId: 'source-1',
          label: 'AGENTS.md',
          path: '/tmp/AGENTS.md',
          text: '# Rules\n',
          parts: [{ text: '# Rules\n', editable: true }],
          segmentId: 'prompt-segment-1',
        },
        {
          editable: false,
          text: '</rules>\n</system_prompt>',
          parts: [
            { text: '</rules>', editable: false, tag: true },
            { text: '\n', editable: false },
            { text: '</system_prompt>', editable: false, tag: true },
          ],
          segmentId: 'prompt-segment-2',
        },
      ],
    });

    const rows = [...browser.document.querySelectorAll('#outline .tree-row')];
    expect(rows.map((row) => row.querySelector('.row-name')?.textContent)).toEqual(['rules', 'AGENTS.md']);
    expect(rows.map((row) => row.getAttribute('aria-level'))).toEqual(['1', '2']);
    expect(rows[1]?.querySelector('.glyph')?.classList.contains('source')).toBe(true);
    expect(rows[1]?.querySelector('.row-detail')?.textContent).toBe('/tmp');
    await browser.happyDOM.close();
  });

  it('groups the sections Pi adds after the system prompt', async () => {
    const { browser, promptEditor } = loadPromptEditor();
    const pi = { kind: 'locked', anchorId: 'prompt-segment-1', label: '<tools>', generatedBy: 'pi', tags: [] };

    promptEditor.render({
      ...emptyStage,
      generation: 1,
      regionCount: 0,
      sources: [],
      lockedRegions: [pi],
      navigation: [pi],
      segments: [
        {
          editable: false,
          text: '<system_prompt>\n<identity>\nHello\n</identity>\n</system_prompt>\n',
          parts: [
            { text: '<system_prompt>', editable: false, tag: true, anchorId: 'tag-0' },
            { text: '\n', editable: false },
            { text: '<identity>', editable: false, tag: true, anchorId: 'tag-1' },
            { text: '\nHello\n', editable: false },
            { text: '</identity>', editable: false, tag: true },
            { text: '\n', editable: false },
            { text: '</system_prompt>', editable: false, tag: true },
            { text: '\n', editable: false },
          ],
          segmentId: 'prompt-segment-0',
        },
        {
          editable: false,
          text: '<tools>\n- read\n</tools>',
          parts: [
            { text: '<tools>', editable: false, tag: true, anchorId: 'tag-2' },
            { text: '\n- read\n', editable: false },
            { text: '</tools>', editable: false, tag: true },
          ],
          segmentId: 'prompt-segment-1',
        },
      ],
    });

    const tree = browser.document.querySelector('#outline .tree');
    const entries = [...(tree?.children ?? [])].map((entry) =>
      entry.classList.contains('tree-group')
        ? `group: ${entry.textContent}`
        : entry.querySelector('.row-name')?.textContent,
    );
    expect(entries).toEqual(['identity', 'group: Added by Pi', 'tools']);
    const tools = browser.document.querySelectorAll('#outline .tree-row')[1];
    expect(tools?.classList.contains('pi')).toBe(true);
    expect(tools?.querySelector('.row-pi')?.textContent).toBe('Pi');
    await browser.happyDOM.close();
  });

  it('shows the header title and subtitle from the payload identity', async () => {
    const { browser, promptEditor } = loadPromptEditor();

    promptEditor.render({
      ...emptyStage,
      generation: 1,
      regionCount: 0,
      sources: [],
      lockedRegions: [],
      navigation: [],
      segments: [],
      identity: { key: 'roux', name: 'Roux', job: 'Pilot' },
    });

    expect(browser.document.getElementById('identity-name')?.textContent).toBe('Roux');
    expect(browser.document.getElementById('identity-sub')?.textContent).toBe('System prompt · Pilot');
    expect(browser.document.title).toBe('Roux · System Prompt Editor');
    await browser.happyDOM.close();
  });

  it('reconstructs a staged source from Markdown islands and locked tags', async () => {
    const values: string[] = [];
    const { browser, messages, promptEditor } = loadPromptEditor({
      mount(_parent, options) {
        const index = values.push(options.doc) - 1;
        return {
          value: () => values[index] ?? '',
          setValue: (value: string) => {
            values[index] = value;
          },
          focus: () => undefined,
          destroy: () => undefined,
        };
      },
    });
    const source = { kind: 'source', path: '/tmp/AGENTS.md', label: 'AGENTS.md', regionIds: ['source-1'], tags: [] };

    promptEditor.render({
      ...emptyStage,
      generation: 1,
      draftRevision: 1,
      pendingRegionCount: 1,
      pendingRegionIds: ['source-1'],
      pendingFileCount: 1,
      regionCount: 1,
      sources: [source],
      lockedRegions: [],
      navigation: [source],
      segments: [
        {
          editable: true,
          regionId: 'source-1',
          label: 'AGENTS.md',
          path: '/tmp/AGENTS.md',
          text: '<section>\n# Original\n</section>',
          parts: [
            { text: '<section>', editable: false, tag: true },
            { text: '\n', editable: true },
            { text: '# Original\n', editable: true },
            { text: '</section>', editable: false, tag: true },
          ],
          segmentId: 'segment-1',
        },
      ],
    });
    values[0] = '# Revised\n';
    (browser.document.getElementById('preview') as unknown as HTMLButtonElement | null)?.click();

    expect(browser.document.querySelectorAll('.markdown-editor')).toHaveLength(1);
    expect(browser.document.querySelectorAll('.locked-tag')).toHaveLength(2);
    expect(messages).toEqual([
      { action: 'preview', generation: 1, regions: { 'source-1': '<section>\n# Revised\n</section>' } },
    ]);
    await browser.happyDOM.close();
  });
});
