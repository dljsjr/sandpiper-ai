import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applySourceChanges,
  buildProjection,
  buildSourceChanges,
  fileCandidate,
  rollbackSourceChanges,
  SourceChangedError,
  sourceCandidate,
} from './projection.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'prompt-projection-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writeSource(name: string, content: string): string {
  const path = join(root, name);
  writeFileSync(path, content, 'utf-8');
  return path;
}

describe('prompt projection', () => {
  it('maps unique file content and locks the surrounding text', () => {
    const source = writeSource('source.md', 'editable markdown\n');

    const projection = buildProjection('generated before\neditable markdown\ngenerated after\n', [
      fileCandidate(source),
    ]);

    expect(projection.segments.map((segment) => [segment.editable, segment.text])).toEqual([
      [false, 'generated before\n'],
      [true, 'editable markdown'],
      [false, '\ngenerated after\n'],
    ]);
  });

  it('leaves text that occurs more than once locked', () => {
    const source = writeSource('source.md', 'repeated\n');

    const projection = buildProjection('repeated and repeated', [fileCandidate(source)]);

    expect(projection.regions).toEqual([]);
  });

  it('builds one shadow source from multiple fragment edits', () => {
    const source = writeSource('template.md', 'before LOCKED after\n');
    const projection = buildProjection('before LOCKED after', [
      sourceCandidate(source, 0, 7, 0),
      sourceCandidate(source, 13, 19, 13),
    ]);

    const changes = buildSourceChanges(
      projection,
      new Map([
        [projection.regions[0]!.id, 'ahead '],
        [projection.regions[1]!.id, ' behind'],
      ]),
    );

    expect(changes).toHaveLength(1);
    expect(changes[0]!.updatedSource).toBe('ahead LOCKED behind\n');
    expect(readFileSync(source, 'utf-8')).toBe('before LOCKED after\n');
  });

  it('edits a symlink target without replacing the symlink', () => {
    const target = writeSource('target.md', 'original\n');
    const link = join(root, 'source.md');
    symlinkSync(target, link);
    const projection = buildProjection('original', [fileCandidate(link)]);

    applySourceChanges(buildSourceChanges(projection, new Map([[projection.regions[0]!.id, 'changed']])));

    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(readFileSync(target, 'utf-8')).toBe('changed\n');
  });

  it('keeps the file mode when it writes a source', () => {
    const source = writeSource('script.md', 'original\n');
    chmodSync(source, 0o640);
    const projection = buildProjection('original', [fileCandidate(source)]);

    applySourceChanges(buildSourceChanges(projection, new Map([[projection.regions[0]!.id, 'changed']])));

    expect(statSync(source).mode & 0o777).toBe(0o640);
    expect(readFileSync(source, 'utf-8')).toBe('changed\n');
  });

  it('rolls back every written source when a later write fails', () => {
    const first = writeSource('first.md', 'first\n');
    const lockedDir = join(root, 'locked');
    mkdirSync(lockedDir);
    const second = join(lockedDir, 'second.md');
    writeFileSync(second, 'second\n', 'utf-8');
    const projection = buildProjection('first second', [fileCandidate(first), fileCandidate(second)]);
    const changes = buildSourceChanges(
      projection,
      new Map([
        [projection.regions[0]!.id, 'changed first'],
        [projection.regions[1]!.id, 'changed second'],
      ]),
    );
    // The replacement file is created beside the source, so a read-only directory makes the second write fail.
    chmodSync(lockedDir, 0o555);

    try {
      expect(() => applySourceChanges(changes)).toThrow(/EACCES|permission denied/i);
    } finally {
      chmodSync(lockedDir, 0o755);
    }

    expect(readFileSync(first, 'utf-8')).toBe('first\n');
    expect(readFileSync(second, 'utf-8')).toBe('second\n');
  });

  it('can roll back an applied edit', () => {
    const source = writeSource('source.md', 'original\n');
    const projection = buildProjection('original', [fileCandidate(source)]);

    const applied = applySourceChanges(
      buildSourceChanges(projection, new Map([[projection.regions[0]!.id, 'invalid edit']])),
    );
    rollbackSourceChanges(applied);

    expect(readFileSync(source, 'utf-8')).toBe('original\n');
  });

  it('refuses to overwrite a source changed after render', () => {
    const source = writeSource('source.md', 'original\n');
    const projection = buildProjection('original', [fileCandidate(source)]);
    writeFileSync(source, 'external edit\n', 'utf-8');

    expect(() => buildSourceChanges(projection, new Map([[projection.regions[0]!.id, 'editor edit']]))).toThrow(
      SourceChangedError,
    );
    expect(readFileSync(source, 'utf-8')).toBe('external edit\n');
  });

  it('refuses to apply a change to a source changed after preview', () => {
    const source = writeSource('source.md', 'original\n');
    const projection = buildProjection('original', [fileCandidate(source)]);
    const changes = buildSourceChanges(projection, new Map([[projection.regions[0]!.id, 'editor edit']]));
    writeFileSync(source, 'external edit\n', 'utf-8');

    expect(() => applySourceChanges(changes)).toThrow(SourceChangedError);
    expect(readFileSync(source, 'utf-8')).toBe('external edit\n');
  });
});
