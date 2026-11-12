import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildProjection, fileCandidate } from './projection.js';
import { SourceWatcher } from './watcher.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'prompt-watcher-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function watchedSource(): {
  readonly path: string;
  readonly editor: { busy: boolean; projection: ReturnType<typeof buildProjection> };
} {
  const path = join(root, 'AGENTS.md');
  writeFileSync(path, 'original\n', 'utf-8');
  return {
    path: realpathSync(path),
    editor: { busy: false, projection: buildProjection('original', [fileCandidate(path)]) },
  };
}

describe('SourceWatcher', () => {
  it('reports a source once after its content changes on disk', () => {
    const { path, editor } = watchedSource();
    const watcher = new SourceWatcher(editor);
    expect(watcher.check()).toEqual([]);

    writeFileSync(path, 'external edit\n', 'utf-8');

    expect(watcher.check()).toEqual([path]);
    expect(watcher.check()).toEqual([]);
  });

  it('reports a source again after it changes to new content', () => {
    const { path, editor } = watchedSource();
    const watcher = new SourceWatcher(editor);
    writeFileSync(path, 'external edit\n', 'utf-8');
    watcher.check();

    writeFileSync(path, 'another external edit\n', 'utf-8');

    expect(watcher.check()).toEqual([path]);
  });

  it('forgets a change that is reverted to the rendered content', () => {
    const { path, editor } = watchedSource();
    const watcher = new SourceWatcher(editor);
    writeFileSync(path, 'external edit\n', 'utf-8');
    watcher.check();
    writeFileSync(path, 'original\n', 'utf-8');
    expect(watcher.check()).toEqual([]);

    writeFileSync(path, 'external edit\n', 'utf-8');

    expect(watcher.check()).toEqual([path]);
  });

  it('ignores changes while the editor is busy writing', () => {
    const { path, editor } = watchedSource();
    const watcher = new SourceWatcher(editor);
    editor.busy = true;

    writeFileSync(path, 'editor write\n', 'utf-8');

    expect(watcher.check()).toEqual([]);
  });
});
