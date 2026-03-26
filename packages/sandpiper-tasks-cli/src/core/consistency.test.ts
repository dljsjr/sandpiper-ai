import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { countTaskFilesOnDisk, isIndexConsistent } from './consistency.js';
import { parseFrontmatter } from './frontmatter.js';
import { updateIndex } from './index-update.js';
import { completeTask, createProject, createTask, pickupTask, updateTaskFields } from './mutate.js';
import type { IndexedTask } from './types.js';

/**
 * Read frontmatter directly from a task file on disk.
 */
function readDiskFrontmatter(path: string): Record<string, string | string[]> {
  return parseFrontmatter(readFileSync(path, 'utf-8'));
}

/**
 * Assert that an indexed task matches the on-disk frontmatter for all key fields.
 */
function expectIndexMatchesDisk(indexed: IndexedTask, diskPath: string): void {
  const disk = readDiskFrontmatter(diskPath);

  expect(indexed.title).toBe(disk.title);
  expect(indexed.status).toBe(disk.status);
  expect(indexed.kind).toBe(disk.kind);
  expect(indexed.priority).toBe(disk.priority);
  expect(indexed.assignee).toBe(disk.assignee);
  expect(indexed.reporter).toBe(disk.reporter);
  expect(indexed.createdAt).toBe(disk.created_at);
  expect(indexed.updatedAt).toBe(disk.updated_at);

  // Relationship arrays: disk may have undefined for missing, index always has []
  // Resolution (optional on both sides)
  const diskResolution = typeof disk.resolution === 'string' ? disk.resolution : undefined;
  expect(indexed.resolution).toBe(diskResolution);

  const diskDeps = Array.isArray(disk.depends_on) ? disk.depends_on : [];
  const diskBlocked = Array.isArray(disk.blocked_by) ? disk.blocked_by : [];
  const diskRelated = Array.isArray(disk.related) ? disk.related : [];
  expect(indexed.dependsOn).toEqual(diskDeps);
  expect(indexed.blockedBy).toEqual(diskBlocked);
  expect(indexed.related).toEqual(diskRelated);
}

describe('Index-file consistency', () => {
  let tasksDir: string;

  beforeEach(() => {
    tasksDir = mkdtempSync(join(tmpdir(), 'consistency-test-'));
  });

  afterEach(() => {
    rmSync(tasksDir, { recursive: true, force: true });
  });

  describe('fresh index matches disk', () => {
    it('should index a simple task with matching fields', () => {
      createProject(tasksDir, 'FOO');
      const { key, path } = createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Test task',
        reporter: 'USER',
      });

      const index = updateIndex(tasksDir);
      const indexed = index.tasks[key];
      expect(indexed).toBeDefined();
      expectIndexMatchesDisk(indexed!, path);
    });

    it('should index a task with relationships matching disk', () => {
      createProject(tasksDir, 'FOO');
      createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Dep target',
        reporter: 'USER',
      });
      const { key, path } = createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'MEDIUM',
        title: 'With deps',
        reporter: 'AGENT',
        dependsOn: ['FOO-1'],
        blockedBy: ['FOO-1'],
        related: ['FOO-1'],
      });

      const index = updateIndex(tasksDir);
      const indexed = index.tasks[key];
      expect(indexed).toBeDefined();
      expectIndexMatchesDisk(indexed!, path);
    });

    it('should index a subtask with correct parent and matching fields', () => {
      createProject(tasksDir, 'FOO');
      const parent = createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Parent',
        reporter: 'USER',
      });
      const { key, path } = createTask(tasksDir, {
        project: 'FOO',
        kind: 'SUBTASK',
        priority: 'MEDIUM',
        title: 'Child',
        reporter: 'AGENT',
        parent: parent.key,
      });

      const index = updateIndex(tasksDir);
      const indexed = index.tasks[key];
      expect(indexed).toBeDefined();
      expect(indexed?.parent).toBe(parent.key);
      expectIndexMatchesDisk(indexed!, path);
    });
  });

  describe('CLI mutations keep index in sync', () => {
    it('should reflect pickup in both index and disk', () => {
      createProject(tasksDir, 'FOO');
      const { key, path } = createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Pickup test',
        reporter: 'USER',
      });

      pickupTask(path);
      const index = updateIndex(tasksDir);
      const indexed = index.tasks[key];
      expect(indexed).toBeDefined();
      expectIndexMatchesDisk(indexed!, path);
      expect(indexed?.status).toBe('IN PROGRESS');
      expect(indexed?.assignee).toBe('AGENT');
    });

    it('should reflect complete in both index and disk', () => {
      createProject(tasksDir, 'FOO');
      const { key, path } = createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Complete test',
        reporter: 'USER',
      });

      completeTask(path, true, 'DONE');
      const index = updateIndex(tasksDir);
      const indexed = index.tasks[key];
      expect(indexed).toBeDefined();
      expectIndexMatchesDisk(indexed!, path);
      expect(indexed?.status).toBe('COMPLETE');
      expect(indexed?.resolution).toBe('DONE');
    });

    it('should reflect field updates in both index and disk', () => {
      createProject(tasksDir, 'FOO');
      const { key, path } = createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Update test',
        reporter: 'USER',
      });

      updateTaskFields(path, {
        status: 'IN PROGRESS',
        assignee: 'AGENT',
        priority: 'LOW',
      });
      const index = updateIndex(tasksDir);
      const indexed = index.tasks[key];
      expect(indexed).toBeDefined();
      expectIndexMatchesDisk(indexed!, path);
      expect(indexed?.priority).toBe('LOW');
      expect(indexed?.assignee).toBe('AGENT');
    });
  });

  describe('out-of-band disk modifications', () => {
    it('should detect and re-index a file modified outside the CLI', async () => {
      createProject(tasksDir, 'FOO');
      const { key, path } = createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Original title',
        reporter: 'USER',
      });

      // First index
      const index1 = updateIndex(tasksDir);
      expect(index1.tasks[key]?.title).toBe('Original title');
      expect(index1.tasks[key]?.status).toBe('NOT STARTED');

      // Simulate out-of-band edit (user edits the file directly)
      await new Promise((r) => setTimeout(r, 10)); // ensure mtime differs
      let content = readFileSync(path, 'utf-8');
      content = content.replace('title: "Original title"', 'title: "Modified by hand"');
      content = content.replace('status: NOT STARTED', 'status: IN PROGRESS');
      content = content.replace('# Original title', '# Modified by hand');
      writeFileSync(path, content);

      // Re-index should pick up the changes
      const index2 = updateIndex(tasksDir);
      const reindexed = index2.tasks[key];
      expect(reindexed).toBeDefined();
      expect(reindexed?.title).toBe('Modified by hand');
      expect(reindexed?.status).toBe('IN PROGRESS');
      expectIndexMatchesDisk(reindexed!, path);
    });

    it('should detect a new file added outside the CLI', () => {
      createProject(tasksDir, 'FOO');

      // First index — empty project
      const index1 = updateIndex(tasksDir);
      const fooTasks1 = Object.values(index1.tasks).filter((t) => t.project === 'FOO');
      expect(fooTasks1).toHaveLength(0);

      // Manually write a task file (simulating shell script or manual edit)
      writeFileSync(
        join(tasksDir, 'FOO', 'FOO-1.md'),
        '---\ntitle: "Manually added"\nstatus: NOT STARTED\nkind: BUG\npriority: HIGH\nassignee: UNASSIGNED\nreporter: USER\ncreated_at: 2026-03-21T10:00:00Z\nupdated_at: 2026-03-21T10:00:00Z\n---\n\n# Manually added\n\nAdded outside the CLI.\n',
      );

      // Re-index should find it
      const index2 = updateIndex(tasksDir);
      const indexed = index2.tasks['FOO-1'];
      expect(indexed).toBeDefined();
      expect(indexed?.title).toBe('Manually added');
      expect(indexed?.kind).toBe('BUG');
      expectIndexMatchesDisk(indexed!, join(tasksDir, 'FOO', 'FOO-1.md'));
    });

    it('should detect a file deleted outside the CLI', () => {
      createProject(tasksDir, 'FOO');
      const { key, path } = createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'MEDIUM',
        title: 'Will be deleted',
        reporter: 'USER',
      });

      // First index
      const index1 = updateIndex(tasksDir);
      expect(index1.tasks[key]).toBeDefined();

      // Delete the file outside the CLI
      rmSync(path);

      // Re-index should remove it
      const index2 = updateIndex(tasksDir);
      expect(index2.tasks[key]).toBeUndefined();
    });

    it('should handle simultaneous add, modify, and delete', async () => {
      createProject(tasksDir, 'FOO');
      const task1 = createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Will be modified',
        reporter: 'USER',
      });
      const task2 = createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'LOW',
        title: 'Will be deleted',
        reporter: 'USER',
      });

      // First index
      updateIndex(tasksDir);

      await new Promise((r) => setTimeout(r, 10));

      // Modify task1 out-of-band
      let content = readFileSync(task1.path, 'utf-8');
      content = content.replace('priority: HIGH', 'priority: LOW');
      writeFileSync(task1.path, content);

      // Delete task2 out-of-band
      rmSync(task2.path);

      // Add task3 out-of-band
      writeFileSync(
        join(tasksDir, 'FOO', 'FOO-3.md'),
        '---\ntitle: "Brand new"\nstatus: NOT STARTED\nkind: TASK\npriority: MEDIUM\nassignee: UNASSIGNED\nreporter: AGENT\ncreated_at: 2026-03-21T12:00:00Z\nupdated_at: 2026-03-21T12:00:00Z\n---\n\n# Brand new\n',
      );

      // Re-index should reflect all three changes
      const index = updateIndex(tasksDir);

      // Modified
      expect(index.tasks[task1.key]?.priority).toBe('LOW');
      expectIndexMatchesDisk(index.tasks[task1.key]!, task1.path);

      // Deleted
      expect(index.tasks[task2.key]).toBeUndefined();

      // Added
      expect(index.tasks['FOO-3']).toBeDefined();
      expect(index.tasks['FOO-3']?.title).toBe('Brand new');
      expectIndexMatchesDisk(index.tasks['FOO-3']!, join(tasksDir, 'FOO', 'FOO-3.md'));
    });
  });
});

describe('countTaskFilesOnDisk', () => {
  let tasksDir: string;

  beforeEach(() => {
    tasksDir = mkdtempSync(join(tmpdir(), 'count-test-'));
  });

  afterEach(() => {
    rmSync(tasksDir, { recursive: true, force: true });
  });

  it('should return 0 for an empty tasks directory', () => {
    expect(countTaskFilesOnDisk(tasksDir)).toBe(0);
  });

  it('should count top-level task files', () => {
    createProject(tasksDir, 'FOO');
    createTask(tasksDir, { project: 'FOO', kind: 'TASK', priority: 'HIGH', title: 'A', reporter: 'USER' });
    createTask(tasksDir, { project: 'FOO', kind: 'TASK', priority: 'HIGH', title: 'B', reporter: 'USER' });
    expect(countTaskFilesOnDisk(tasksDir)).toBe(2);
  });

  it('should count subtasks', () => {
    createProject(tasksDir, 'FOO');
    const parent = createTask(tasksDir, {
      project: 'FOO',
      kind: 'TASK',
      priority: 'HIGH',
      title: 'Parent',
      reporter: 'USER',
    });
    createTask(tasksDir, {
      project: 'FOO',
      kind: 'SUBTASK',
      priority: 'MEDIUM',
      title: 'Child',
      reporter: 'USER',
      parent: parent.key,
    });
    expect(countTaskFilesOnDisk(tasksDir)).toBe(2); // parent + child
  });

  it('should count across multiple projects', () => {
    createProject(tasksDir, 'AAA');
    createProject(tasksDir, 'BBB');
    createTask(tasksDir, { project: 'AAA', kind: 'TASK', priority: 'HIGH', title: 'A1', reporter: 'USER' });
    createTask(tasksDir, { project: 'BBB', kind: 'TASK', priority: 'HIGH', title: 'B1', reporter: 'USER' });
    createTask(tasksDir, { project: 'BBB', kind: 'TASK', priority: 'HIGH', title: 'B2', reporter: 'USER' });
    expect(countTaskFilesOnDisk(tasksDir)).toBe(3);
  });
});

describe('isIndexConsistent', () => {
  let tasksDir: string;

  beforeEach(() => {
    tasksDir = mkdtempSync(join(tmpdir(), 'heal-test-'));
  });

  afterEach(() => {
    rmSync(tasksDir, { recursive: true, force: true });
  });

  it('should return true when index matches disk', () => {
    createProject(tasksDir, 'FOO');
    createTask(tasksDir, { project: 'FOO', kind: 'TASK', priority: 'HIGH', title: 'T1', reporter: 'USER' });
    const index = updateIndex(tasksDir);
    expect(isIndexConsistent(tasksDir, index)).toBe(true);
  });

  it('should return false when a file is added out-of-band', () => {
    createProject(tasksDir, 'FOO');
    createTask(tasksDir, { project: 'FOO', kind: 'TASK', priority: 'HIGH', title: 'T1', reporter: 'USER' });
    const index = updateIndex(tasksDir);

    // Add a file out-of-band
    writeFileSync(
      join(tasksDir, 'FOO', 'FOO-2.md'),
      '---\ntitle: "OOB"\nstatus: NOT STARTED\nkind: TASK\npriority: LOW\nassignee: UNASSIGNED\nreporter: USER\ncreated_at: 2026-01-01T00:00:00Z\nupdated_at: 2026-01-01T00:00:00Z\n---\n\n# OOB\n',
    );

    expect(isIndexConsistent(tasksDir, index)).toBe(false);
  });

  it('should return false when a file is deleted out-of-band', () => {
    createProject(tasksDir, 'FOO');
    const { path } = createTask(tasksDir, {
      project: 'FOO',
      kind: 'TASK',
      priority: 'HIGH',
      title: 'T1',
      reporter: 'USER',
    });
    const index = updateIndex(tasksDir);

    rmSync(path);

    expect(isIndexConsistent(tasksDir, index)).toBe(false);
  });
});
