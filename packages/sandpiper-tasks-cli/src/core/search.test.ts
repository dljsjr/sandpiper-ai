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
      expect(key).toMatch(/^[A-Z]{3}-\d+$/);
    }
  });
});
