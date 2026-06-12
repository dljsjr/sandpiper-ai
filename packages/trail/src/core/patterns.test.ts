import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { walkTaskFiles } from './patterns.js';

describe('walkTaskFiles', () => {
  let tasksDir: string;

  beforeEach(() => {
    tasksDir = mkdtempSync(join(tmpdir(), 'walk-task-files-test-'));
  });

  afterEach(() => {
    rmSync(tasksDir, { recursive: true, force: true });
  });

  it('yields nothing for an empty tasks directory', () => {
    const entries = [...walkTaskFiles(tasksDir)];
    expect(entries).toEqual([]);
  });

  it('yields top-level task files in a project directory', () => {
    mkdirSync(join(tasksDir, 'FOO'), { recursive: true });
    writeFileSync(join(tasksDir, 'FOO', 'FOO-1.md'), '---\ntitle: Test\n---\n');
    writeFileSync(join(tasksDir, 'FOO', 'FOO-2.md'), '---\ntitle: Test\n---\n');

    const entries = [...walkTaskFiles(tasksDir)];

    expect(entries).toHaveLength(2);
    expect(entries[0]!.key).toBe('FOO-1');
    expect(entries[0]!.project).toBe('FOO');
    expect(entries[0]!.parent).toBeUndefined();
    expect(entries[1]!.key).toBe('FOO-2');
  });

  it('yields subtask files with parent set', () => {
    mkdirSync(join(tasksDir, 'FOO'), { recursive: true });
    mkdirSync(join(tasksDir, 'FOO', 'FOO-1'), { recursive: true });
    writeFileSync(join(tasksDir, 'FOO', 'FOO-1.md'), '---\ntitle: Parent\n---\n');
    writeFileSync(join(tasksDir, 'FOO', 'FOO-1', 'FOO-2.md'), '---\ntitle: Child\n---\n');

    const entries = [...walkTaskFiles(tasksDir)];

    expect(entries).toHaveLength(2);
    const subtask = entries.find((e) => e.key === 'FOO-2');
    expect(subtask).toBeDefined();
    expect(subtask!.parent).toBe('FOO-1');
  });

  it('ignores non-project directories', () => {
    mkdirSync(join(tasksDir, 'lowercase'), { recursive: true });
    writeFileSync(join(tasksDir, 'lowercase', 'file.md'), 'content');

    const entries = [...walkTaskFiles(tasksDir)];
    expect(entries).toEqual([]);
  });

  it('ignores non-task files in project directories', () => {
    mkdirSync(join(tasksDir, 'FOO'), { recursive: true });
    writeFileSync(join(tasksDir, 'FOO', 'README.md'), 'content');
    writeFileSync(join(tasksDir, 'FOO', 'PROJECT.md'), '---\nname: Foo\n---\n');

    const entries = [...walkTaskFiles(tasksDir)];
    expect(entries).toEqual([]);
  });

  it('ignores .moved tombstones', () => {
    mkdirSync(join(tasksDir, 'FOO'), { recursive: true });
    writeFileSync(join(tasksDir, 'FOO', 'FOO-1.moved'), 'FOO-2\n');

    const entries = [...walkTaskFiles(tasksDir)];
    expect(entries).toEqual([]);
  });

  it('ignores archive directories', () => {
    mkdirSync(join(tasksDir, 'FOO', 'archive'), { recursive: true });
    writeFileSync(join(tasksDir, 'FOO', 'archive', 'FOO-1.md'), '---\ntitle: Archived\n---\n');

    const entries = [...walkTaskFiles(tasksDir)];
    expect(entries).toEqual([]);
  });

  it('walks multiple projects', () => {
    mkdirSync(join(tasksDir, 'FOO'), { recursive: true });
    mkdirSync(join(tasksDir, 'BAR'), { recursive: true });
    writeFileSync(join(tasksDir, 'FOO', 'FOO-1.md'), '---\ntitle: Test\n---\n');
    writeFileSync(join(tasksDir, 'BAR', 'BAR-1.md'), '---\ntitle: Test\n---\n');

    const entries = [...walkTaskFiles(tasksDir)];

    expect(entries).toHaveLength(2);
    expect(entries.find((e) => e.project === 'FOO')).toBeDefined();
    expect(entries.find((e) => e.project === 'BAR')).toBeDefined();
  });

  it('yields entries with absolute paths', () => {
    mkdirSync(join(tasksDir, 'FOO'), { recursive: true });
    writeFileSync(join(tasksDir, 'FOO', 'FOO-1.md'), '---\ntitle: Test\n---\n');

    const [entry] = [...walkTaskFiles(tasksDir)];

    expect(entry!.path).toBe(join(tasksDir, 'FOO', 'FOO-1.md'));
  });
});
