import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type DiagnosticPrompt, PromptDiagnosticError } from './diagnostic.js';
import { PromptEditorState, StaleProjectionError } from './state.js';

const identity = { key: 'test', name: 'Test', job: 'Tester' };

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'prompt-editor-state-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function diagnosticPrompt(content: string, overrides: Partial<DiagnosticPrompt> = {}): DiagnosticPrompt {
  return {
    prompt: `<identity><content>${content}</content></identity>`,
    warnings: [],
    sources: { appendSystemPrompts: [], contextFiles: [] },
    editableSpans: [],
    ...overrides,
  };
}

/** Each render returns the next result: a diagnostic, or an error to throw. */
function renders(...results: Array<DiagnosticPrompt | Error>): () => Promise<DiagnosticPrompt> {
  const queue = [...results];
  return async () => {
    const next = queue.shift();
    if (next === undefined) throw new Error('unexpected render');
    if (next instanceof Error) throw next;
    return next;
  };
}

async function identityEditor(
  ...results: Array<DiagnosticPrompt | Error>
): Promise<{ state: PromptEditorState; identityFile: string }> {
  const identityFile = join(root, 'IDENTITY.md');
  writeFileSync(identityFile, 'original\n', 'utf-8');
  const state = await PromptEditorState.create({
    render: renders(...(results.length > 0 ? results : [diagnosticPrompt('original')])),
    catalog: { promptSources: [identityFile] },
    identity,
  });
  return { state, identityFile };
}

function firstRegionId(state: PromptEditorState): string {
  const region = state.projection.regions[0];
  if (!region) throw new Error('expected an editable region');
  return region.id;
}

describe('PromptEditorState', () => {
  it('renders the page payload with the header identity and stage fields', async () => {
    const { state, identityFile } = await identityEditor();

    const payload = state.renderPayload();

    expect(payload).toMatchObject({
      generation: 1,
      identity,
      draftRevision: 0,
      pendingFileCount: 0,
      pendingRegionCount: 0,
      pendingRegionIds: [],
      previewReady: false,
      regionCount: 1,
    });
    expect(payload.sources.map((source) => source.path)).toEqual([realpathSync(identityFile)]);
  });

  it('locks XML tags while it allows content edits', async () => {
    const source = join(root, 'system.md');
    writeFileSync(source, '<section>original</section>\n', 'utf-8');
    const state = await PromptEditorState.create({
      render: renders(
        diagnosticPrompt('', {
          prompt: '<section>original</section>',
          sources: { systemPrompt: source, appendSystemPrompts: [], contextFiles: [] },
        }),
      ),
      catalog: { promptSources: [] },
      identity,
    });
    const regionId = firstRegionId(state);

    expect(() => state.stage(state.generation, regionId, '<renamed>original</renamed>')).toThrow(/XML tags/);
    expect(() => state.stageAll(state.generation, new Map([[regionId, '<renamed>original</renamed>']]))).toThrow(
      StaleProjectionError,
    );
    state.stage(state.generation, regionId, '<section>changed</section>');
    const preview = state.preview();

    expect(preview.files[0]?.diff).toContain('<section>changed</section>');
    expect(readFileSync(source, 'utf-8')).toBe('<section>original</section>\n');
  });

  it('stages a source region without writing the source', async () => {
    const { state, identityFile } = await identityEditor();

    const payload = state.stage(state.generation, firstRegionId(state), 'changed');

    await expect(state.apply(state.generation, state.draftRevision)).rejects.toThrow(/Preview/);
    expect(readFileSync(identityFile, 'utf-8')).toBe('original\n');
    expect(payload.pendingRegionCount).toBe(1);
    expect(state.shadowSources[0]?.updatedSource).toBe('changed\n');
    expect(state.shadowProjection.prompt).toContain('changed');
  });

  it('unstages a region edited back to its rendered text', async () => {
    const { state } = await identityEditor();
    const regionId = firstRegionId(state);
    state.stage(state.generation, regionId, 'changed');

    const payload = state.stage(state.generation, regionId, 'original');

    expect(payload).toMatchObject({ pendingRegionCount: 0, pendingRegionIds: [], draftRevision: 2 });
  });

  it('refuses to edit against an earlier generation', async () => {
    const { state } = await identityEditor();

    expect(() => state.stage(state.generation + 1, firstRegionId(state), 'changed')).toThrow(/refresh before editing/);
  });

  it('refuses to refresh over staged edits', async () => {
    const { state, identityFile } = await identityEditor();
    state.stage(state.generation, firstRegionId(state), 'changed');

    await expect(state.refresh()).rejects.toThrow(/pending edits/);

    expect(readFileSync(identityFile, 'utf-8')).toBe('original\n');
    expect(state.stagedEdits.size).toBe(1);
  });

  it('previews the complete staged snapshot', async () => {
    const { state, identityFile } = await identityEditor();
    state.stageAll(state.generation, new Map([[firstRegionId(state), 'changed']]));

    const preview = state.preview();

    expect(preview.fileCount).toBe(1);
    expect(preview.files[0]?.diff).toContain('+changed');
    expect(readFileSync(identityFile, 'utf-8')).toBe('original\n');
  });

  it('shows a unified source diff without writing the source', async () => {
    const { state, identityFile } = await identityEditor();
    state.stage(state.generation, firstRegionId(state), 'changed');

    const preview = state.preview();

    const path = realpathSync(identityFile);
    expect(readFileSync(identityFile, 'utf-8')).toBe('original\n');
    expect(preview.previewReady).toBe(true);
    expect(preview.files).toEqual([
      {
        path,
        diff: `--- ${path} (current)\n+++ ${path} (staged)\n@@ -1,1 +1,1 @@\n-original\n+changed\n`,
      },
    ]);
  });

  it('applies the previewed sources and renders again', async () => {
    const { state, identityFile } = await identityEditor(diagnosticPrompt('original'), diagnosticPrompt('changed'));
    state.stage(state.generation, firstRegionId(state), 'changed');
    const preview = state.preview();

    const payload = await state.apply(state.generation, preview.draftRevision);

    expect(readFileSync(identityFile, 'utf-8')).toBe('changed\n');
    expect(payload.generation).toBe(2);
    expect(state.projection.prompt).toContain('changed');
  });

  it('refuses to apply edits staged after the preview', async () => {
    const { state, identityFile } = await identityEditor();
    const regionId = firstRegionId(state);
    state.stage(state.generation, regionId, 'changed');
    const preview = state.preview();
    state.stage(state.generation, regionId, 'changed again');

    await expect(state.apply(state.generation, preview.draftRevision)).rejects.toThrow(/Preview/);
    expect(readFileSync(identityFile, 'utf-8')).toBe('original\n');
  });

  it('restores the source when rendering again fails', async () => {
    const { state, identityFile } = await identityEditor(
      diagnosticPrompt('original'),
      new PromptDiagnosticError('invalid prompt'),
    );
    state.stage(state.generation, firstRegionId(state), 'invalid');
    const preview = state.preview();

    await expect(state.apply(state.generation, preview.draftRevision)).rejects.toThrow(PromptDiagnosticError);

    expect(readFileSync(identityFile, 'utf-8')).toBe('original\n');
  });

  it('makes every prompt source editable where it renders', async () => {
    const files = ['bootstrap-mode.md', 'identity-intro.md', 'voice-contract.md'].map((name, index) => {
      const path = join(root, name);
      writeFileSync(path, `<section_${index}>\nFragment ${index}.\n</section_${index}>\n`, 'utf-8');
      return path;
    });
    const rendered = files.map((path) => readFileSync(path, 'utf-8').trimEnd()).join('\n');
    const state = await PromptEditorState.create({
      render: renders(diagnosticPrompt('', { prompt: `<system_prompt>\n${rendered}\n</system_prompt>` })),
      catalog: { promptSources: files },
      identity,
    });

    expect(new Set(state.projection.regions.map((region) => region.path))).toEqual(
      new Set(files.map((path) => realpathSync(path))),
    );
  });

  it('opens only files the current prompt shows as editable', async () => {
    const { state, identityFile } = await identityEditor();

    expect(state.sourcePath(realpathSync(identityFile))).toBe(realpathSync(identityFile));
    expect(() => state.sourcePath(join(root, 'other.md'))).toThrow(/Not an editable source/);
  });
});
