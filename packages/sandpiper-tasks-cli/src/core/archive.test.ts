import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { archiveCompletedTasks, listArchivedTasks } from './archive.js';

function writeTask(dir: string, key: string, status: string, resolution?: string): void {
  const resLine = resolution ? `\nresolution: ${resolution}` : '';
  const content = `---
title: "Task ${key}"
status: ${status}${resLine}
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-01-01T00:00:00Z
updated_at: 2026-01-01T00:00:00Z
---

# Task ${key}
`;
  writeFileSync(join(dir, `${key}.md`), content);
}

describe('archiveCompletedTasks', () => {
  let tasksDir: string;

  beforeEach(() => {
    tasksDir = join(import.meta.dirname!, '..', '..', 'test-fixtures', `archive-test-${Date.now()}`);
    mkdirSync(join(tasksDir, 'SHR'), { recursive: true });
    mkdirSync(join(tasksDir, 'TCL'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tasksDir, { recursive: true, force: true });
  });

  it('should move completed tasks to archive directory', () => {
    writeTask(join(tasksDir, 'SHR'), 'SHR-1', 'COMPLETE', 'DONE');
    writeTask(join(tasksDir, 'SHR'), 'SHR-2', 'NOT STARTED');

    const result = archiveCompletedTasks(tasksDir);

    expect(result.archived).toEqual(['SHR-1']);
    expect(result.skipped).toEqual(['SHR-2']);

    // File moved to archive
    expect(existsSync(join(tasksDir, 'SHR', 'archive', 'SHR-1.md'))).toBe(true);
    // Original removed
    expect(existsSync(join(tasksDir, 'SHR', 'SHR-1.md'))).toBe(false);
    // Non-complete stays
    expect(existsSync(join(tasksDir, 'SHR', 'SHR-2.md'))).toBe(true);
  });

  it('should move subtask directories with their parent', () => {
    writeTask(join(tasksDir, 'SHR'), 'SHR-1', 'COMPLETE', 'DONE');
    // Create subtask directory
    const subtaskDir = join(tasksDir, 'SHR', 'SHR-1');
    mkdirSync(subtaskDir, { recursive: true });
    writeTask(subtaskDir, 'SHR-3', 'COMPLETE', 'DONE');

    const result = archiveCompletedTasks(tasksDir);

    expect(result.archived).toContain('SHR-1');
    // Subtask dir moved to archive
    expect(existsSync(join(tasksDir, 'SHR', 'archive', 'SHR-1', 'SHR-3.md'))).toBe(true);
    // Original subtask dir removed
    expect(existsSync(join(tasksDir, 'SHR', 'SHR-1'))).toBe(false);
  });

  it('should filter by project when specified', () => {
    writeTask(join(tasksDir, 'SHR'), 'SHR-1', 'COMPLETE', 'DONE');
    writeTask(join(tasksDir, 'TCL'), 'TCL-1', 'COMPLETE', 'DONE');

    const result = archiveCompletedTasks(tasksDir, 'SHR');

    expect(result.archived).toEqual(['SHR-1']);
    // TCL task untouched
    expect(existsSync(join(tasksDir, 'TCL', 'TCL-1.md'))).toBe(true);
  });

  it('should skip non-complete tasks', () => {
    writeTask(join(tasksDir, 'SHR'), 'SHR-1', 'IN PROGRESS');
    writeTask(join(tasksDir, 'SHR'), 'SHR-2', 'NEEDS REVIEW');
    writeTask(join(tasksDir, 'SHR'), 'SHR-3', 'NOT STARTED');

    const result = archiveCompletedTasks(tasksDir);

    expect(result.archived).toEqual([]);
    expect(result.skipped).toEqual(['SHR-1', 'SHR-2', 'SHR-3']);
  });

  it('should preserve task file content', () => {
    writeTask(join(tasksDir, 'SHR'), 'SHR-1', 'COMPLETE', 'DONE');
    const originalContent = readFileSync(join(tasksDir, 'SHR', 'SHR-1.md'), 'utf-8');

    archiveCompletedTasks(tasksDir);

    const archivedContent = readFileSync(join(tasksDir, 'SHR', 'archive', 'SHR-1.md'), 'utf-8');
    expect(archivedContent).toBe(originalContent);
  });

  it('should handle empty projects gracefully', () => {
    const result = archiveCompletedTasks(tasksDir);
    expect(result.archived).toEqual([]);
    expect(result.skipped).toEqual([]);
  });
});

describe('listArchivedTasks', () => {
  let tasksDir: string;

  beforeEach(() => {
    tasksDir = join(import.meta.dirname!, '..', '..', 'test-fixtures', `archive-list-test-${Date.now()}`);
    mkdirSync(join(tasksDir, 'SHR', 'archive'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tasksDir, { recursive: true, force: true });
  });

  it('should list archived task keys', () => {
    writeTask(join(tasksDir, 'SHR', 'archive'), 'SHR-1', 'COMPLETE', 'DONE');
    writeTask(join(tasksDir, 'SHR', 'archive'), 'SHR-2', 'COMPLETE', 'WONTFIX');

    const result = listArchivedTasks(tasksDir);
    expect(result).toEqual(['SHR-1', 'SHR-2']);
  });

  it('should filter by project', () => {
    writeTask(join(tasksDir, 'SHR', 'archive'), 'SHR-1', 'COMPLETE', 'DONE');
    mkdirSync(join(tasksDir, 'TCL', 'archive'), { recursive: true });
    writeTask(join(tasksDir, 'TCL', 'archive'), 'TCL-1', 'COMPLETE', 'DONE');

    const result = listArchivedTasks(tasksDir, 'SHR');
    expect(result).toEqual(['SHR-1']);
  });

  it('should return empty array when no archive exists', () => {
    const result = listArchivedTasks(tasksDir, 'TCL');
    expect(result).toEqual([]);
  });
});
