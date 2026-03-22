import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseFrontmatter } from './frontmatter.js';
import { updateIndex } from './index-update.js';
import { moveTask } from './move.js';
import { createProject, createTask } from './mutate.js';

function fm(path: string) {
  return parseFrontmatter(readFileSync(path, 'utf-8'));
}

describe('moveTask', () => {
  let tasksDir: string;

  beforeEach(() => {
    tasksDir = mkdtempSync(join(tmpdir(), 'move-test-'));
  });

  afterEach(() => {
    rmSync(tasksDir, { recursive: true, force: true });
  });

  describe('kind change within same project', () => {
    it('should convert TASK to BUG (field-only, no file move)', () => {
      createProject(tasksDir, 'FOO');
      const { key, path } = createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Was a task',
        reporter: 'USER',
      });

      const result = moveTask(tasksDir, key, { kind: 'BUG' });

      expect(result.newKey).toBe(key); // same key
      expect(fm(path).kind).toBe('BUG');
    });

    it('should convert BUG to TASK', () => {
      createProject(tasksDir, 'FOO');
      const { key, path } = createTask(tasksDir, {
        project: 'FOO',
        kind: 'BUG',
        priority: 'HIGH',
        title: 'Was a bug',
        reporter: 'USER',
      });

      const result = moveTask(tasksDir, key, { kind: 'TASK' });
      expect(result.newKey).toBe(key);
      expect(fm(path).kind).toBe('TASK');
    });
  });

  describe('promote subtask to top-level', () => {
    it('should move subtask file to project root', () => {
      createProject(tasksDir, 'FOO');
      const parent = createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Parent',
        reporter: 'USER',
      });
      const child = createTask(tasksDir, {
        project: 'FOO',
        kind: 'SUBTASK',
        priority: 'MEDIUM',
        title: 'Child',
        reporter: 'USER',
        parent: parent.key,
      });

      const result = moveTask(tasksDir, child.key, { kind: 'TASK' });

      expect(result.newKey).toBe(child.key); // same project, same key
      expect(existsSync(child.path)).toBe(false); // old location gone
      const newPath = join(tasksDir, 'FOO', `${child.key}.md`);
      expect(existsSync(newPath)).toBe(true);
      expect(fm(newPath).kind).toBe('TASK');
    });
  });

  describe('demote task to subtask', () => {
    it("should move task file into parent's subtask directory", () => {
      createProject(tasksDir, 'FOO');
      const parent = createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'New parent',
        reporter: 'USER',
      });
      const standalone = createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'MEDIUM',
        title: 'Will become subtask',
        reporter: 'USER',
      });

      const result = moveTask(tasksDir, standalone.key, {
        kind: 'SUBTASK',
        parent: parent.key,
      });

      expect(result.newKey).toBe(standalone.key);
      expect(existsSync(standalone.path)).toBe(false);
      const newPath = join(tasksDir, 'FOO', parent.key, `${standalone.key}.md`);
      expect(existsSync(newPath)).toBe(true);
      expect(fm(newPath).kind).toBe('SUBTASK');
    });

    it('should reparent existing subtasks when demoting a task with subtasks', () => {
      createProject(tasksDir, 'FOO');
      const newParent = createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'New parent',
        reporter: 'USER',
      });
      const oldParent = createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Old parent becoming subtask',
        reporter: 'USER',
      });
      const grandchild = createTask(tasksDir, {
        project: 'FOO',
        kind: 'SUBTASK',
        priority: 'MEDIUM',
        title: 'Grandchild',
        reporter: 'USER',
        parent: oldParent.key,
      });

      moveTask(tasksDir, oldParent.key, {
        kind: 'SUBTASK',
        parent: newParent.key,
      });

      // Grandchild should now be under newParent's subtask dir
      const grandchildNewPath = join(tasksDir, 'FOO', newParent.key, `${grandchild.key}.md`);
      expect(existsSync(grandchildNewPath)).toBe(true);
    });

    it('should reject demotion to subtask without --parent', () => {
      createProject(tasksDir, 'FOO');
      const { key } = createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'No parent specified',
        reporter: 'USER',
      });

      expect(() => moveTask(tasksDir, key, { kind: 'SUBTASK' })).toThrow('parent');
    });

    it('should reject subtask under another subtask', () => {
      createProject(tasksDir, 'FOO');
      const parent = createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Parent',
        reporter: 'USER',
      });
      const sub = createTask(tasksDir, {
        project: 'FOO',
        kind: 'SUBTASK',
        priority: 'MEDIUM',
        title: 'Subtask',
        reporter: 'USER',
        parent: parent.key,
      });
      const standalone = createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'LOW',
        title: 'Will try bad move',
        reporter: 'USER',
      });

      expect(() =>
        moveTask(tasksDir, standalone.key, {
          kind: 'SUBTASK',
          parent: sub.key,
        }),
      ).toThrow();
    });
  });

  describe('cross-project move', () => {
    it('should re-key task when moving to a new project', () => {
      createProject(tasksDir, 'FOO');
      createProject(tasksDir, 'BAR');
      const { key } = createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Moving to BAR',
        reporter: 'USER',
      });

      const result = moveTask(tasksDir, key, { project: 'BAR' });

      expect(result.newKey).toBe('BAR-1');
      expect(existsSync(join(tasksDir, 'BAR', 'BAR-1.md'))).toBe(true);
      expect(existsSync(join(tasksDir, 'FOO', `${key}.md`))).toBe(false);
    });

    it('should create a .moved tombstone at the original location', () => {
      createProject(tasksDir, 'FOO');
      createProject(tasksDir, 'BAR');
      const { key } = createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Will leave tombstone',
        reporter: 'USER',
      });

      const result = moveTask(tasksDir, key, { project: 'BAR' });

      const tombstone = join(tasksDir, 'FOO', `${key}.moved`);
      expect(existsSync(tombstone)).toBe(true);
      expect(readFileSync(tombstone, 'utf-8').trim()).toBe(result.newKey);
    });

    it('should move subtasks along with parent to new project', () => {
      createProject(tasksDir, 'FOO');
      createProject(tasksDir, 'BAR');
      const parent = createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Parent',
        reporter: 'USER',
      });
      const _sub1 = createTask(tasksDir, {
        project: 'FOO',
        kind: 'SUBTASK',
        priority: 'MEDIUM',
        title: 'Sub 1',
        reporter: 'USER',
        parent: parent.key,
      });
      const _sub2 = createTask(tasksDir, {
        project: 'FOO',
        kind: 'SUBTASK',
        priority: 'LOW',
        title: 'Sub 2',
        reporter: 'USER',
        parent: parent.key,
      });

      const result = moveTask(tasksDir, parent.key, { project: 'BAR' });

      // Parent re-keyed
      expect(result.newKey).toBe('BAR-1');
      // Subtasks re-keyed and moved
      const barDir = join(tasksDir, 'BAR', 'BAR-1');
      expect(existsSync(barDir)).toBe(true);
      const subtaskFiles = readdirSync(barDir).filter((f) => f.endsWith('.md'));
      expect(subtaskFiles).toHaveLength(2);
    });

    it('should update inbound references in other task files', () => {
      createProject(tasksDir, 'FOO');
      createProject(tasksDir, 'BAR');
      const target = createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Will be moved',
        reporter: 'USER',
      });
      createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'MEDIUM',
        title: 'Has dependency',
        reporter: 'USER',
        dependsOn: [target.key],
      });

      const result = moveTask(tasksDir, target.key, { project: 'BAR' });

      // FOO-2's depends_on should now reference the new key
      const depFm = fm(join(tasksDir, 'FOO', 'FOO-2.md'));
      expect(depFm.depends_on).toContain(result.newKey);
      expect(depFm.depends_on).not.toContain(target.key);
    });

    it('should reject moving a subtask to another project without kind change', () => {
      createProject(tasksDir, 'FOO');
      createProject(tasksDir, 'BAR');
      const parent = createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Parent',
        reporter: 'USER',
      });
      const sub = createTask(tasksDir, {
        project: 'FOO',
        kind: 'SUBTASK',
        priority: 'MEDIUM',
        title: 'Subtask',
        reporter: 'USER',
        parent: parent.key,
      });

      expect(() => moveTask(tasksDir, sub.key, { project: 'BAR' })).toThrow();
    });

    it('should allow moving subtask to another project when also promoting to TASK', () => {
      createProject(tasksDir, 'FOO');
      createProject(tasksDir, 'BAR');
      const parent = createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Parent',
        reporter: 'USER',
      });
      const sub = createTask(tasksDir, {
        project: 'FOO',
        kind: 'SUBTASK',
        priority: 'MEDIUM',
        title: 'Promoted subtask',
        reporter: 'USER',
        parent: parent.key,
      });

      const result = moveTask(tasksDir, sub.key, {
        project: 'BAR',
        kind: 'TASK',
      });

      expect(result.newKey).toBe('BAR-1');
      expect(existsSync(join(tasksDir, 'BAR', 'BAR-1.md'))).toBe(true);
      expect(fm(join(tasksDir, 'BAR', 'BAR-1.md')).kind).toBe('TASK');
    });
  });

  describe('tombstone and counter', () => {
    it('should prevent counter reuse via tombstone after index rebuild', () => {
      createProject(tasksDir, 'FOO');
      createProject(tasksDir, 'BAR');
      createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Task 1',
        reporter: 'USER',
      });
      const t2 = createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'MEDIUM',
        title: 'Task 2 (will move)',
        reporter: 'USER',
      });

      // Build index, move task 2
      updateIndex(tasksDir);
      moveTask(tasksDir, t2.key, { project: 'BAR' });

      // Delete and rebuild index
      rmSync(join(tasksDir, 'index.toon'));
      const index = updateIndex(tasksDir);

      // Counter should be 3 (not 2, because FOO-2.moved exists)
      expect(index.counters.FOO?.nextTaskNumber).toBe(3);
    });
  });
});
