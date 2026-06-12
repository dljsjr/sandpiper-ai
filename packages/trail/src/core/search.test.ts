import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { searchTasks } from './search.js';

function writeTaskFile(dir: string, project: string, key: string, content: string, parent?: string): void {
  const projectDir = join(dir, project);
  let taskDir = projectDir;
  if (parent) {
    taskDir = join(projectDir, parent);
  }
  mkdirSync(taskDir, { recursive: true });
  writeFileSync(join(taskDir, `${key}.md`), content);
}

describe('searchTasks', () => {
  let tasksDir: string;

  beforeEach(() => {
    tasksDir = mkdtempSync(join(tmpdir(), 'search-test-'));

    writeTaskFile(
      tasksDir,
      'SHR',
      'SHR-1',
      '---\ntitle: "FIFO manager"\nstatus: IN PROGRESS\nkind: TASK\n---\n\n# FIFO manager\n\nImplement persistent FIFO lifecycle with O_RDWR sentinel pattern.\n',
    );
    writeTaskFile(
      tasksDir,
      'SHR',
      'SHR-2',
      '---\ntitle: "Signal parser"\nstatus: COMPLETE\nkind: TASK\n---\n\n# Signal parser\n\nParse line-delimited signals from the relay channel.\n',
    );
    writeTaskFile(
      tasksDir,
      'SHR',
      'SHR-3',
      '---\ntitle: "Write unit tests"\nstatus: NOT STARTED\nkind: SUBTASK\n---\n\n# Write unit tests\n\nTest the FIFO sentinel pattern.\n',
      'SHR-1',
    );
    writeTaskFile(
      tasksDir,
      'CLI',
      'CLI-1',
      '---\ntitle: "Build CLI"\nstatus: NOT STARTED\nkind: TASK\n---\n\n# Build CLI\n\nImplement the commander-based CLI for task management.\n',
    );
  });

  afterEach(() => {
    rmSync(tasksDir, { recursive: true, force: true });
  });

  it('should find tasks matching a text pattern', () => {
    const keys = searchTasks(tasksDir, 'FIFO');
    expect(keys).toContain('SHR-1');
    expect(keys).toContain('SHR-3'); // body mentions FIFO
    expect(keys).not.toContain('SHR-2');
    expect(keys).not.toContain('CLI-1');
  });

  it('should rank BM25 matches by relevance by default', () => {
    writeTaskFile(tasksDir, 'SHR', 'SHR-4', '# Sparse\n\nneedle\n');
    writeTaskFile(tasksDir, 'SHR', 'SHR-5', '# Dense\n\nneedle needle needle needle needle\n');

    const keys = searchTasks(tasksDir, 'needle');
    expect(keys.slice(0, 2)).toEqual(['SHR-5', 'SHR-4']);
  });

  it('should use JavaScript regex matching with regex=true', () => {
    const keys = searchTasks(tasksDir, 'sentin(?:el|al)', undefined, { regex: true });
    expect(keys).toContain('SHR-1');
    expect(keys).toContain('SHR-3');
  });

  it('should use ripgrep literal matching with ripgrep=true and regex=false', () => {
    const keys = searchTasks(tasksDir, 'sentin(?:el|al)', undefined, { ripgrep: true });
    expect(keys).toHaveLength(0);
  });

  it('should use ripgrep regex matching when regex and ripgrep are both true', () => {
    const keys = searchTasks(tasksDir, 'sentin(?:el|al)', undefined, { regex: true, ripgrep: true });
    expect(keys).toContain('SHR-1');
    expect(keys).toContain('SHR-3');
  });

  it('should throw on ripgrep errors other than no matches', () => {
    expect(() => searchTasks(tasksDir, '(', undefined, { regex: true, ripgrep: true })).toThrow(
      'ripgrep search failed',
    );
  });

  it('should be case insensitive by default', () => {
    const keys = searchTasks(tasksDir, 'fifo');
    expect(keys).toContain('SHR-1');
  });

  it('should search across title and body', () => {
    const keys = searchTasks(tasksDir, 'sentinel');
    expect(keys).toContain('SHR-1');
    expect(keys).toContain('SHR-3');
  });

  it('should return empty array for no matches', () => {
    const keys = searchTasks(tasksDir, 'xyznonexistent');
    expect(keys).toHaveLength(0);
  });

  it('should narrow search to a specific project directory', () => {
    const keys = searchTasks(tasksDir, 'task', { project: 'CLI' });
    expect(keys).toContain('CLI-1');
    expect(keys).not.toContain('SHR-1');
  });

  it("should narrow search to a specific parent's subtask directory", () => {
    const keys = searchTasks(tasksDir, 'sentinel', {
      project: 'SHR',
      parent: 'SHR-1',
    });
    expect(keys).toContain('SHR-3');
    expect(keys).not.toContain('SHR-1'); // SHR-1 is outside the subtask dir
  });

  it('should handle regex-special characters in the search pattern', () => {
    // Should not crash on patterns with regex metacharacters
    const keys = searchTasks(tasksDir, 'O_RDWR');
    expect(keys).toContain('SHR-1');
  });

  it('should search only .md files', () => {
    // Write a non-md file that matches
    writeFileSync(join(tasksDir, 'SHR', 'notes.txt'), 'FIFO stuff');
    const keys = searchTasks(tasksDir, 'FIFO');
    // Should not include non-md files (no task key extractable)
    for (const key of keys) {
      expect(key).toMatch(/^[A-Z]{2,}-\d+$/);
    }
  });

  it('should exclude archived task files from default BM25 search', () => {
    writeTaskFile(tasksDir, 'SHR/archive', 'SHR-99', '# Archived FIFO\n\nFIFO archive-only marker\n');

    const keys = searchTasks(tasksDir, 'archive-only');

    expect(keys).not.toContain('SHR-99');
  });

  it('should exclude archived task files from regex search', () => {
    writeTaskFile(tasksDir, 'SHR/archive', 'SHR-99', '# Archived FIFO\n\nFIFO archive-only marker\n');

    const keys = searchTasks(tasksDir, 'archive-only', undefined, { regex: true });

    expect(keys).not.toContain('SHR-99');
  });

  it('should exclude archived task files from ripgrep search', () => {
    writeTaskFile(tasksDir, 'SHR/archive', 'SHR-99', '# Archived FIFO\n\nFIFO archive-only marker\n');

    const keys = searchTasks(tasksDir, 'archive-only', undefined, { ripgrep: true });

    expect(keys).not.toContain('SHR-99');
  });
});
