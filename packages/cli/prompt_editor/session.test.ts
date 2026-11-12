import { EventEmitter } from 'node:events';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagnosticPrompt } from './diagnostic.js';
import { type EditorWindow, editorCall, parseEditorMessage, runEditorSession } from './session.js';
import { PromptEditorState } from './state.js';

class FakeWindow extends EventEmitter implements EditorWindow {
  readonly sent: string[] = [];
  closed = false;

  send(js: string): void {
    this.sent.push(js);
  }

  close(): void {
    this.closed = true;
  }

  calls(): Array<[string, unknown]> {
    return this.sent.map((js) => {
      const match = /^window\.promptEditor\.(\w+)\((.*)\)$/s.exec(js);
      if (!match) throw new Error(`unexpected page call: ${js}`);
      return [match[1] ?? '', JSON.parse(match[2] ?? 'null')];
    });
  }
}

let root: string;
let identityFile: string;
const openWindows: FakeWindow[] = [];

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'prompt-editor-session-'));
  identityFile = join(root, 'IDENTITY.md');
  writeFileSync(identityFile, 'original\n', 'utf-8');
});

afterEach(() => {
  for (const window of openWindows.splice(0)) window.emit('closed');
  rmSync(root, { recursive: true, force: true });
});

function diagnostic(content: string): DiagnosticPrompt {
  return {
    prompt: `<identity><content>${content}</content></identity>`,
    warnings: [],
    sources: { appendSystemPrompts: [], contextFiles: [] },
    editableSpans: [],
  };
}

async function startSession(openSource = vi.fn(async () => {})) {
  const state = await PromptEditorState.create({
    render: async () => diagnostic('original'),
    catalog: { promptSources: [identityFile] },
    identity: { key: 'sandpiper', name: 'Sandpiper', job: 'Sandpiper' },
  });
  const window = new FakeWindow();
  openWindows.push(window);
  const session = runEditorSession(window, state, { openSource, watchIntervalMs: 60_000 });
  return { state, window, session, openSource };
}

describe('parseEditorMessage', () => {
  it('reads the messages the page sends', () => {
    expect(parseEditorMessage({ action: 'preview', generation: 2, regions: { a: 'text' } })).toEqual({
      action: 'preview',
      generation: 2,
      regions: new Map([['a', 'text']]),
    });
    expect(parseEditorMessage({ action: 'reveal', path: '/tmp/a.md' })).toEqual({
      action: 'reveal',
      path: '/tmp/a.md',
    });
  });

  it('ignores unknown actions and rejects known actions with bad fields', () => {
    expect(parseEditorMessage({ action: 'dance' })).toBeUndefined();
    expect(() => parseEditorMessage({ action: 'apply', generation: 1 })).toThrow(/draftRevision/);
    expect(() => parseEditorMessage({ action: 'stage', generation: '1', regionId: 'a', text: '' })).toThrow(/integer/);
  });
});

describe('runEditorSession', () => {
  it('renders the prompt when the page is ready and stages page edits', async () => {
    const { state, window } = await startSession();

    window.emit('ready');
    window.emit('message', {
      action: 'stage',
      generation: state.generation,
      regionId: state.projection.regions[0]?.id,
      text: 'changed',
    });

    await vi.waitFor(() => expect(window.sent).toHaveLength(2));
    const [render, stage] = window.calls();
    expect(render?.[0]).toBe('render');
    expect(render?.[1]).toMatchObject({ generation: 1, identity: { name: 'Sandpiper' } });
    expect(stage).toEqual([
      'updateStage',
      {
        draftRevision: 1,
        pendingFileCount: 1,
        pendingRegionCount: 1,
        pendingRegionIds: [state.projection.regions[0]?.id],
        previewReady: false,
      },
    ]);
  });

  it('shows errors on the page instead of failing', async () => {
    const { window } = await startSession();

    window.emit('message', { action: 'stage', generation: 9, regionId: 'missing', text: 'x' });
    window.emit('message', { action: 'apply', generation: 1 });

    await vi.waitFor(() => expect(window.sent).toHaveLength(2));
    expect(window.calls()).toEqual([
      ['showError', 'The prompt changed; refresh before editing'],
      ['showError', 'Editor message is missing draftRevision'],
    ]);
  });

  it('opens only files the prompt shows as editable', async () => {
    const { window, openSource } = await startSession();

    window.emit('message', { action: 'reveal', path: realpathSync(identityFile) });
    window.emit('message', { action: 'open', path: join(root, 'secret.md') });

    await vi.waitFor(() => expect(window.sent).toHaveLength(1));
    expect(openSource).toHaveBeenCalledExactlyOnceWith(realpathSync(identityFile), true);
    expect(window.calls()).toEqual([
      ['showError', `Not an editable source of this prompt: ${join(root, 'secret.md')}`],
    ]);
  });

  it('finishes when the window closes', async () => {
    const { window, session } = await startSession();

    window.emit('closed');

    await expect(session).resolves.toBeUndefined();
  });

  it('closes the window and fails when Glimpse reports an error', async () => {
    const { window, session } = await startSession();

    window.emit('error', new Error('host crashed'));

    await expect(session).rejects.toThrow('host crashed');
    expect(window.closed).toBe(true);
  });
});

describe('editorCall', () => {
  it('calls the page controller with a JSON argument', () => {
    expect(editorCall('sourcesChanged', ['/tmp/a "b".md'])).toBe(
      'window.promptEditor.sourcesChanged(["/tmp/a \\"b\\".md"])',
    );
  });
});
