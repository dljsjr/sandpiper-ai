import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractActivityLog } from './activity-log.js';
import { parseFrontmatter } from './frontmatter.js';
import { updateIndex } from './index-update.js';
import {
  applyFieldUpdates,
  applyInternalFieldUpdates,
  completeTask,
  createProject,
  createTask,
  pickupTask,
  updateTaskFields,
  writeTaskFileAuditably,
} from './mutate.js';

function readTaskFrontmatter(path: string): Record<string, string | string[]> {
  return parseFrontmatter(readFileSync(path, 'utf-8'));
}

describe('createProject', () => {
  let tasksDir: string;

  beforeEach(() => {
    tasksDir = mkdtempSync(join(tmpdir(), 'mutate-test-'));
  });

  afterEach(() => {
    rmSync(tasksDir, { recursive: true, force: true });
  });

  it('should create a project directory', () => {
    createProject(tasksDir, 'FOO');
    expect(existsSync(join(tasksDir, 'FOO'))).toBe(true);
  });

  it('should throw if project already exists', () => {
    createProject(tasksDir, 'FOO');
    expect(() => createProject(tasksDir, 'FOO')).toThrow('already exists');
  });

  it('should reject invalid project keys', () => {
    expect(() => createProject(tasksDir, 'fo')).toThrow('uppercase');
    expect(() => createProject(tasksDir, 'F')).toThrow('uppercase');
    expect(() => createProject(tasksDir, 'F1O')).toThrow('uppercase');
  });

  it('should accept project keys longer than 3 letters', () => {
    createProject(tasksDir, 'TOOLS');
    expect(existsSync(join(tasksDir, 'TOOLS'))).toBe(true);
  });
});

describe('createTask', () => {
  let tasksDir: string;

  beforeEach(() => {
    tasksDir = mkdtempSync(join(tmpdir(), 'mutate-test-'));
    createProject(tasksDir, 'FOO');
  });

  afterEach(() => {
    rmSync(tasksDir, { recursive: true, force: true });
  });

  it('should create a TASK at the project root', () => {
    const result = createTask(tasksDir, {
      project: 'FOO',
      kind: 'TASK',
      priority: 'HIGH',
      title: 'My first task',
      reporter: 'USER',
    });

    expect(result.key).toBe('FOO-1');
    expect(existsSync(result.path)).toBe(true);

    const fm = readTaskFrontmatter(result.path);
    expect(fm.title).toBe('My first task');
    expect(fm.status).toBe('NOT STARTED');
    expect(fm.kind).toBe('TASK');
    expect(fm.priority).toBe('HIGH');
    expect(fm.assignee).toBe('UNASSIGNED');
    expect(fm.reporter).toBe('USER');
  });

  it('should create a BUG at the project root', () => {
    const result = createTask(tasksDir, {
      project: 'FOO',
      kind: 'BUG',
      priority: 'HIGH',
      title: 'Something broke',
      reporter: 'AGENT',
    });

    expect(result.key).toBe('FOO-1');
    const fm = readTaskFrontmatter(result.path);
    expect(fm.kind).toBe('BUG');
    expect(fm.reporter).toBe('AGENT');
  });

  it('should create a SUBTASK under a parent', () => {
    createTask(tasksDir, {
      project: 'FOO',
      kind: 'TASK',
      priority: 'HIGH',
      title: 'Parent',
      reporter: 'USER',
    });

    const result = createTask(tasksDir, {
      project: 'FOO',
      kind: 'SUBTASK',
      priority: 'MEDIUM',
      title: 'Child subtask',
      reporter: 'AGENT',
      parent: 'FOO-1',
    });

    expect(result.key).toBe('FOO-2');
    expect(result.path).toContain(join('FOO', 'FOO-1', 'FOO-2.md'));
  });

  it('should increment task numbers monotonically', () => {
    const r1 = createTask(tasksDir, {
      project: 'FOO',
      kind: 'TASK',
      priority: 'HIGH',
      title: 'First',
      reporter: 'USER',
    });
    const r2 = createTask(tasksDir, {
      project: 'FOO',
      kind: 'TASK',
      priority: 'MEDIUM',
      title: 'Second',
      reporter: 'USER',
    });
    const r3 = createTask(tasksDir, {
      project: 'FOO',
      kind: 'BUG',
      priority: 'LOW',
      title: 'Third',
      reporter: 'AGENT',
    });

    expect(r1.key).toBe('FOO-1');
    expect(r2.key).toBe('FOO-2');
    expect(r3.key).toBe('FOO-3');
  });

  it('should require parent for SUBTASK', () => {
    expect(() =>
      createTask(tasksDir, {
        project: 'FOO',
        kind: 'SUBTASK',
        priority: 'HIGH',
        title: 'Orphan',
        reporter: 'USER',
      }),
    ).toThrow('parent');
  });

  it("should auto-create project if it doesn't exist", () => {
    const result = createTask(tasksDir, {
      project: 'BAR',
      kind: 'TASK',
      priority: 'MEDIUM',
      title: 'Auto project',
      reporter: 'USER',
    });

    expect(result.key).toBe('BAR-1');
    expect(existsSync(join(tasksDir, 'BAR'))).toBe(true);
  });

  it('should preserve safe freeform title values', () => {
    const result = createTask(tasksDir, {
      project: 'FOO',
      kind: 'TASK',
      priority: 'MEDIUM',
      title: 'Title "quoted": okay',
      reporter: 'USER',
    });

    const content = readFileSync(result.path, 'utf-8');
    const fm = readTaskFrontmatter(result.path);
    expect(content).toContain('title: "Title \\"quoted\\": okay"');
    expect(fm.title).toBe('Title "quoted": okay');
  });

  it('should reject empty and multi-line title values', () => {
    expect(() =>
      createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'MEDIUM',
        title: '   ',
        reporter: 'USER',
      }),
    ).toThrow('title must be non-empty');

    expect(() =>
      createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'MEDIUM',
        title: 'Injected title"\nstatus: COMPLETE\nignore: "',
        reporter: 'USER',
      }),
    ).toThrow('title must be a single-line string');
  });

  it('should preserve safe freeform reporter values', () => {
    const result = createTask(tasksDir, {
      project: 'FOO',
      kind: 'TASK',
      priority: 'MEDIUM',
      title: 'Freeform reporter',
      reporter: 'Piper "Librarian": Docs',
    });

    const content = readFileSync(result.path, 'utf-8');
    const fm = readTaskFrontmatter(result.path);
    expect(content).toContain('reporter: "Piper \\"Librarian\\": Docs"');
    expect(fm.reporter).toBe('Piper "Librarian": Docs');
  });

  it('should canonicalize conventional reporter values case-insensitively', () => {
    const result = createTask(tasksDir, {
      project: 'FOO',
      kind: 'TASK',
      priority: 'MEDIUM',
      title: 'Canonical reporter',
      reporter: 'agent',
    });

    expect(readTaskFrontmatter(result.path).reporter).toBe('AGENT');
  });

  it('should reject empty and multi-line reporter values', () => {
    expect(() =>
      createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'MEDIUM',
        title: 'Blank reporter',
        reporter: '   ',
      }),
    ).toThrow('reporter must be non-empty');

    expect(() =>
      createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'MEDIUM',
        title: 'Injected reporter',
        reporter: 'Piper\nstatus: COMPLETE',
      }),
    ).toThrow('reporter must be a single-line string');
  });

  it('should include optional relationship fields', () => {
    createTask(tasksDir, {
      project: 'FOO',
      kind: 'TASK',
      priority: 'HIGH',
      title: 'Dep target',
      reporter: 'USER',
    });

    const result = createTask(tasksDir, {
      project: 'FOO',
      kind: 'TASK',
      priority: 'MEDIUM',
      title: 'With deps',
      reporter: 'USER',
      dependsOn: ['FOO-1'],
      related: ['FOO-1'],
    });

    const fm = readTaskFrontmatter(result.path);
    expect(fm.depends_on).toEqual(['FOO-1']);
    expect(fm.related).toEqual(['FOO-1']);
  });
});

describe('applyInternalFieldUpdates', () => {
  it('should normalize an edited flow array field without changing untouched fields', () => {
    const content = `---
title: "Flow array task"
status: NOT STARTED
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
depends_on: [FOO-1, FOO-2]
created_at: 2026-04-01T00:00:00Z
updated_at: 2026-04-01T00:00:00Z
---

# Flow array task
`;

    const updated = applyFieldUpdates(content, { dependsOn: ['FOO-3'] });

    expect(updated).toContain('title: "Flow array task"');
    expect(updated).toContain('depends_on:\n  - FOO-3\nupdated_at:');
    expect(updated).not.toContain('depends_on: [FOO-1, FOO-2]');
    expect(updated).toContain('\n# Flow array task\n');
  });

  it('should leave untouched block scalar fields byte-stable when editing another field', () => {
    const content = `---
title: |
  Multi-line
  title
status: NOT STARTED
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-04-01T00:00:00Z
updated_at: 2026-04-01T00:00:00Z
---

# Multi-line title
`;

    const updated = applyFieldUpdates(content, { status: 'IN PROGRESS' });

    expect(updated).toContain('title: |\n  Multi-line\n  title\n');
    expect(updated).toContain('status: IN PROGRESS');
  });

  it('should reject scalar edits to sequence-form fields that the surgical writer cannot round-trip', () => {
    const content = `---
title:
  - Bad
  - Shape
status: NOT STARTED
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-04-01T00:00:00Z
updated_at: 2026-04-01T00:00:00Z
---

# Bad Shape
`;

    expect(() => applyFieldUpdates(content, { title: 'New title' })).toThrow('non-round-trippable');
  });

  it('should reject empty scalar edits that the surgical writer cannot round-trip', () => {
    const content = `---
title:
status: NOT STARTED
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-04-01T00:00:00Z
updated_at: 2026-04-01T00:00:00Z
---

# Empty title
`;

    expect(() => applyFieldUpdates(content, { title: 'New title' })).toThrow('non-round-trippable');
  });

  it('should reject editing block scalar fields that the surgical writer cannot round-trip', () => {
    const content = `---
title: |
  Multi-line
  title
status: NOT STARTED
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-04-01T00:00:00Z
updated_at: 2026-04-01T00:00:00Z
---

# Multi-line title
`;

    expect(() => applyFieldUpdates(content, { title: 'New title' })).toThrow('non-round-trippable');
  });

  it('should expose an explicit internal API for kind updates', () => {
    const content = `---
title: "Example"
status: NOT STARTED
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-04-01T00:00:00Z
updated_at: 2026-04-01T00:00:00Z
---

# Example
`;

    const updated = applyInternalFieldUpdates(content, { kind: 'BUG' });

    expect(parseFrontmatter(updated).kind).toBe('BUG');
  });
});

describe('updateTaskFields', () => {
  let tasksDir: string;
  let taskPath: string;

  beforeEach(() => {
    tasksDir = mkdtempSync(join(tmpdir(), 'mutate-test-'));
    createProject(tasksDir, 'FOO');
    const result = createTask(tasksDir, {
      project: 'FOO',
      kind: 'TASK',
      priority: 'HIGH',
      title: 'Original',
      reporter: 'USER',
    });
    taskPath = result.path;
    // FOO-2..FOO-7: real fixtures so relationship-field tests reference existing tasks,
    // not dangling keys the new referential-integrity guard would reject.
    for (let i = 0; i < 6; i++) {
      createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'LOW',
        title: `Related fixture ${i}`,
        reporter: 'USER',
      });
    }
  });

  afterEach(() => {
    rmSync(tasksDir, { recursive: true, force: true });
  });

  it('should update status', () => {
    updateTaskFields(taskPath, { status: 'IN PROGRESS' }, tasksDir);
    const fm = readTaskFrontmatter(taskPath);
    expect(fm.status).toBe('IN PROGRESS');
  });

  it('should record literal on-disk status values in activity log', () => {
    writeFileSync(taskPath, readFileSync(taskPath, 'utf-8').replace('status: NOT STARTED', 'status: banana'));

    updateTaskFields(taskPath, { status: 'IN PROGRESS' }, tasksDir);

    const content = readFileSync(taskPath, 'utf-8');
    const statusChange = extractActivityLog(content)
      .flatMap((entry) => entry.changes)
      .find((change) => change.field === 'status');
    expect(readTaskFrontmatter(taskPath).status).toBe('IN PROGRESS');
    expect(statusChange).toMatchObject({ from: 'banana', to: 'IN PROGRESS' });
  });

  it('should update assignee', () => {
    updateTaskFields(taskPath, { assignee: 'AGENT' }, tasksDir);
    const fm = readTaskFrontmatter(taskPath);
    expect(fm.assignee).toBe('AGENT');
  });

  it('should update priority', () => {
    updateTaskFields(taskPath, { priority: 'LOW' }, tasksDir);
    const fm = readTaskFrontmatter(taskPath);
    expect(fm.priority).toBe('LOW');
  });

  it('should update multiple fields at once', () => {
    updateTaskFields(
      taskPath,
      {
        status: 'IN PROGRESS',
        assignee: 'AGENT',
        priority: 'MEDIUM',
      },
      tasksDir,
    );
    const fm = readTaskFrontmatter(taskPath);
    expect(fm.status).toBe('IN PROGRESS');
    expect(fm.assignee).toBe('AGENT');
    expect(fm.priority).toBe('MEDIUM');
  });

  it('should update the updated_at timestamp', async () => {
    const before = readTaskFrontmatter(taskPath).updated_at as string;
    // Small delay to ensure timestamp differs
    await new Promise((r) => setTimeout(r, 10));
    updateTaskFields(taskPath, { status: 'IN PROGRESS' }, tasksDir);
    const after = readTaskFrontmatter(taskPath).updated_at as string;
    expect(new Date(after).getTime()).toBeGreaterThan(new Date(before).getTime());
  });

  it('should update title (frontmatter and heading)', () => {
    updateTaskFields(taskPath, { title: 'New title' }, tasksDir);
    const fm = readTaskFrontmatter(taskPath);
    expect(fm.title).toBe('New title');
    const content = readFileSync(taskPath, 'utf-8');
    expect(content).toContain('# New title');
  });

  it('should escape safe freeform title updates', () => {
    updateTaskFields(taskPath, { title: 'New "quoted": title' }, tasksDir);
    const fm = readTaskFrontmatter(taskPath);
    const content = readFileSync(taskPath, 'utf-8');
    expect(content).toContain('title: "New \\"quoted\\": title"');
    expect(content).toContain('# New "quoted": title');
    expect(fm.title).toBe('New "quoted": title');
  });

  it('should reject empty and multi-line title updates without modifying the task', () => {
    expect(() => updateTaskFields(taskPath, { title: '' }, tasksDir)).toThrow('title must be non-empty');
    expect(() => updateTaskFields(taskPath, { title: 'Bad title"\nstatus: COMPLETE\nignore: "' }, tasksDir)).toThrow(
      'title must be a single-line string',
    );

    const fm = readTaskFrontmatter(taskPath);
    expect(fm.title).toBe('Original');
    expect(fm.status).toBe('NOT STARTED');
  });

  it('should update reporter', () => {
    updateTaskFields(taskPath, { reporter: 'AGENT' }, tasksDir);
    const fm = readTaskFrontmatter(taskPath);
    expect(fm.reporter).toBe('AGENT');
  });

  it('should preserve safe freeform assignee and reporter updates', () => {
    updateTaskFields(
      taskPath,
      {
        assignee: 'Doug "Reviewer": Staff',
        reporter: 'Piper (Librarian)',
      },
      tasksDir,
    );

    const content = readFileSync(taskPath, 'utf-8');
    const fm = readTaskFrontmatter(taskPath);
    expect(content).toContain('assignee: "Doug \\"Reviewer\\": Staff"');
    expect(content).toContain('reporter: "Piper (Librarian)"');
    expect(fm.assignee).toBe('Doug "Reviewer": Staff');
    expect(fm.reporter).toBe('Piper (Librarian)');
  });

  it('should canonicalize conventional assignee and reporter updates case-insensitively', () => {
    updateTaskFields(taskPath, { assignee: 'agent', reporter: 'user' }, tasksDir);
    const fm = readTaskFrontmatter(taskPath);
    expect(fm.assignee).toBe('AGENT');
    expect(fm.reporter).toBe('USER');
  });

  it('should reject empty and multi-line assignee/reporter updates without modifying the task', () => {
    expect(() => updateTaskFields(taskPath, { assignee: '' }, tasksDir)).toThrow('assignee must be non-empty');
    expect(() => updateTaskFields(taskPath, { reporter: 'Piper\nstatus: COMPLETE' }, tasksDir)).toThrow(
      'reporter must be a single-line string',
    );

    const fm = readTaskFrontmatter(taskPath);
    expect(fm.status).toBe('NOT STARTED');
    expect(fm.reporter).toBe('USER');
  });

  it('should add depends_on', () => {
    updateTaskFields(taskPath, { dependsOn: ['FOO-2', 'FOO-3'] }, tasksDir);
    const fm = readTaskFrontmatter(taskPath);
    expect(fm.depends_on).toEqual(['FOO-2', 'FOO-3']);
  });

  it('should clear depends_on with empty array', () => {
    updateTaskFields(taskPath, { dependsOn: ['FOO-2'] }, tasksDir);
    updateTaskFields(taskPath, { dependsOn: [] }, tasksDir);
    const fm = readTaskFrontmatter(taskPath);
    expect(fm.depends_on).toBeUndefined();
  });

  it('should add blocked_by and related', () => {
    updateTaskFields(
      taskPath,
      {
        blockedBy: ['FOO-5'],
        related: ['FOO-6', 'FOO-7'],
      },
      tasksDir,
    );
    const fm = readTaskFrontmatter(taskPath);
    expect(fm.blocked_by).toEqual(['FOO-5']);
    expect(fm.related).toEqual(['FOO-6', 'FOO-7']);
  });

  it('should not modify created_at', () => {
    const before = readTaskFrontmatter(taskPath).created_at;
    updateTaskFields(taskPath, { status: 'COMPLETE', resolution: 'DONE' }, tasksDir);
    const after = readTaskFrontmatter(taskPath).created_at;
    expect(after).toBe(before);
  });
});

describe('pickupTask', () => {
  let tasksDir: string;
  let taskPath: string;

  beforeEach(() => {
    tasksDir = mkdtempSync(join(tmpdir(), 'mutate-test-'));
    createProject(tasksDir, 'FOO');
    const result = createTask(tasksDir, {
      project: 'FOO',
      kind: 'TASK',
      priority: 'HIGH',
      title: 'Available task',
      reporter: 'USER',
    });
    taskPath = result.path;
  });

  afterEach(() => {
    rmSync(tasksDir, { recursive: true, force: true });
  });

  it('should set assignee to AGENT and status to IN PROGRESS', () => {
    pickupTask(taskPath, tasksDir);
    const fm = readTaskFrontmatter(taskPath);
    expect(fm.assignee).toBe('AGENT');
    expect(fm.status).toBe('IN PROGRESS');
  });
});

describe('completeTask', () => {
  let tasksDir: string;
  let taskPath: string;

  beforeEach(() => {
    tasksDir = mkdtempSync(join(tmpdir(), 'mutate-test-'));
    createProject(tasksDir, 'FOO');
    const result = createTask(tasksDir, {
      project: 'FOO',
      kind: 'TASK',
      priority: 'HIGH',
      title: 'Work done',
      reporter: 'USER',
    });
    taskPath = result.path;
  });

  afterEach(() => {
    rmSync(tasksDir, { recursive: true, force: true });
  });

  it('should set status to NEEDS REVIEW by default', () => {
    completeTask(taskPath, tasksDir);
    const fm = readTaskFrontmatter(taskPath);
    expect(fm.status).toBe('NEEDS REVIEW');
  });

  it('should set status to COMPLETE when final=true with resolution from NEEDS REVIEW', () => {
    completeTask(taskPath, tasksDir);
    completeTask(taskPath, tasksDir, true, 'DONE');
    const fm = readTaskFrontmatter(taskPath);
    expect(fm.status).toBe('COMPLETE');
    expect(fm.resolution).toBe('DONE');
  });

  it('should treat unknown current status as canonical NOT STARTED for final DONE guard', () => {
    writeFileSync(taskPath, readFileSync(taskPath, 'utf-8').replace('status: NOT STARTED', 'status: banana'));

    expect(() => completeTask(taskPath, tasksDir, true, 'DONE')).toThrow('NEEDS REVIEW');
  });
});

describe('consistency guards', () => {
  let tasksDir: string;

  beforeEach(() => {
    tasksDir = mkdtempSync(join(tmpdir(), 'mutate-test-'));
    createProject(tasksDir, 'CON');
  });

  afterEach(() => {
    rmSync(tasksDir, { recursive: true, force: true });
  });

  describe('check 1: parent/child status consistency', () => {
    it('blocks finalizing a parent with a non-COMPLETE subtask', () => {
      const parent = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Parent',
        reporter: 'USER',
      });
      createTask(tasksDir, {
        project: 'CON',
        kind: 'SUBTASK',
        priority: 'LOW',
        title: 'Child',
        reporter: 'USER',
        parent: parent.key,
      });
      completeTask(parent.path, tasksDir);

      expect(() => completeTask(parent.path, tasksDir, true, 'DONE')).toThrow('non-COMPLETE subtasks');
    });

    it('also blocks finalizing a parent with a non-COMPLETE subtask as WONTFIX (unlike check 2, this exemption does not apply here)', () => {
      const parent = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Parent',
        reporter: 'USER',
      });
      createTask(tasksDir, {
        project: 'CON',
        kind: 'SUBTASK',
        priority: 'LOW',
        title: 'Child',
        reporter: 'USER',
        parent: parent.key,
      });
      completeTask(parent.path, tasksDir);

      expect(() => completeTask(parent.path, tasksDir, true, 'WONTFIX')).toThrow('non-COMPLETE subtasks');
    });

    it("also blocks a direct updateTaskFields call to COMPLETE, not just completeTask (Huginn's finding: check 1a used to only fire through completeTask)", () => {
      const parent = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Parent',
        reporter: 'USER',
      });
      createTask(tasksDir, {
        project: 'CON',
        kind: 'SUBTASK',
        priority: 'LOW',
        title: 'Child',
        reporter: 'USER',
        parent: parent.key,
      });

      // task update PARENT --status COMPLETE --resolution DONE reaches updateTaskFields
      // directly, bypassing completeTask's wrapper entirely -- this must be blocked too.
      expect(() => updateTaskFields(parent.path, { status: 'COMPLETE', resolution: 'DONE' }, tasksDir)).toThrow(
        'non-COMPLETE subtasks',
      );
    });

    it('allows finalizing a parent with a non-COMPLETE subtask when forced', () => {
      const parent = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Parent',
        reporter: 'USER',
      });
      createTask(tasksDir, {
        project: 'CON',
        kind: 'SUBTASK',
        priority: 'LOW',
        title: 'Child',
        reporter: 'USER',
        parent: parent.key,
      });
      completeTask(parent.path, tasksDir);

      expect(() => completeTask(parent.path, tasksDir, true, 'DONE', true)).not.toThrow();
      expect(readTaskFrontmatter(parent.path).status).toBe('COMPLETE');
    });

    it('allows finalizing a parent whose subtasks are all COMPLETE', () => {
      const parent = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Parent',
        reporter: 'USER',
      });
      const child = createTask(tasksDir, {
        project: 'CON',
        kind: 'SUBTASK',
        priority: 'LOW',
        title: 'Child',
        reporter: 'USER',
        parent: parent.key,
      });
      completeTask(child.path, tasksDir);
      completeTask(child.path, tasksDir, true, 'DONE');
      completeTask(parent.path, tasksDir);

      expect(() => completeTask(parent.path, tasksDir, true, 'DONE')).not.toThrow();
    });

    it('does not fire when only moving a parent to NEEDS REVIEW', () => {
      const parent = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Parent',
        reporter: 'USER',
      });
      createTask(tasksDir, {
        project: 'CON',
        kind: 'SUBTASK',
        priority: 'LOW',
        title: 'Child',
        reporter: 'USER',
        parent: parent.key,
      });

      expect(() => completeTask(parent.path, tasksDir)).not.toThrow();
    });

    it('blocks activating a subtask whose parent is COMPLETE', () => {
      const parent = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Parent',
        reporter: 'USER',
      });
      const child = createTask(tasksDir, {
        project: 'CON',
        kind: 'SUBTASK',
        priority: 'LOW',
        title: 'Child',
        reporter: 'USER',
        parent: parent.key,
      });
      completeTask(child.path, tasksDir);
      completeTask(child.path, tasksDir, true, 'DONE');
      completeTask(parent.path, tasksDir);
      completeTask(parent.path, tasksDir, true, 'DONE');

      expect(() => updateTaskFields(child.path, { status: 'IN PROGRESS' }, tasksDir)).toThrow('is COMPLETE');
    });

    it('allows activating a subtask whose parent is COMPLETE when forced', () => {
      const parent = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Parent',
        reporter: 'USER',
      });
      const child = createTask(tasksDir, {
        project: 'CON',
        kind: 'SUBTASK',
        priority: 'LOW',
        title: 'Child',
        reporter: 'USER',
        parent: parent.key,
      });
      completeTask(child.path, tasksDir);
      completeTask(child.path, tasksDir, true, 'DONE');
      completeTask(parent.path, tasksDir);
      completeTask(parent.path, tasksDir, true, 'DONE');

      expect(() => updateTaskFields(child.path, { status: 'IN PROGRESS' }, tasksDir, true)).not.toThrow();
      expect(readTaskFrontmatter(child.path).status).toBe('IN PROGRESS');
    });

    it('blocks creating a new subtask under an already-COMPLETE parent', () => {
      const parent = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Parent',
        reporter: 'USER',
      });
      completeTask(parent.path, tasksDir);
      completeTask(parent.path, tasksDir, true, 'DONE');

      expect(() =>
        createTask(tasksDir, {
          project: 'CON',
          kind: 'SUBTASK',
          priority: 'LOW',
          title: 'Late child',
          reporter: 'USER',
          parent: parent.key,
        }),
      ).toThrow('is COMPLETE');
    });

    it('allows creating a subtask under a COMPLETE parent when forced', () => {
      const parent = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Parent',
        reporter: 'USER',
      });
      completeTask(parent.path, tasksDir);
      completeTask(parent.path, tasksDir, true, 'DONE');

      expect(() =>
        createTask(tasksDir, {
          project: 'CON',
          kind: 'SUBTASK',
          priority: 'LOW',
          title: 'Late child',
          reporter: 'USER',
          parent: parent.key,
          force: true,
        }),
      ).not.toThrow();
    });
  });

  describe('check 2: blocker-resolution consistency', () => {
    it('blocks moving to NEEDS REVIEW while a blocker is unresolved', () => {
      const blocker = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Blocker',
        reporter: 'USER',
      });
      const blocked = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Blocked',
        reporter: 'USER',
        blockedBy: [blocker.key],
      });

      expect(() => completeTask(blocked.path, tasksDir)).toThrow('Unresolved blocker');
    });

    it('allows moving to NEEDS REVIEW with an unresolved blocker when forced', () => {
      const blocker = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Blocker',
        reporter: 'USER',
      });
      const blocked = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Blocked',
        reporter: 'USER',
        blockedBy: [blocker.key],
      });

      expect(() => completeTask(blocked.path, tasksDir, false, undefined, true)).not.toThrow();
    });

    it('allows moving to NEEDS REVIEW once the blocker is COMPLETE + DONE', () => {
      const blocker = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Blocker',
        reporter: 'USER',
      });
      const blocked = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Blocked',
        reporter: 'USER',
        blockedBy: [blocker.key],
      });
      completeTask(blocker.path, tasksDir);
      completeTask(blocker.path, tasksDir, true, 'DONE');

      expect(() => completeTask(blocked.path, tasksDir)).not.toThrow();
    });

    it('blocks adding a new unresolved blocker to a task already in NEEDS REVIEW', () => {
      const blocker = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Blocker',
        reporter: 'USER',
      });
      const reviewed = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Reviewed',
        reporter: 'USER',
      });
      completeTask(reviewed.path, tasksDir);

      expect(() => updateTaskFields(reviewed.path, { blockedBy: [blocker.key] }, tasksDir)).toThrow(
        'Unresolved blocker',
      );
    });

    it('blocks finalizing when a stored (not freshly-set) blocker reference has gone dangling', () => {
      const blocker = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Blocker',
        reporter: 'USER',
      });
      const blocked = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Blocked',
        reporter: 'USER',
        blockedBy: [blocker.key],
      });
      // Simulate the blocker becoming unreachable after the reference was validly set
      // (e.g. archive-nesting, manual edit) without touching blocked_by on `blocked`.
      rmSync(blocker.path);

      // completeTask doesn't pass --blocked-by, so this exercises the fallback to the
      // stored array -- checkReferencesExist never runs in this call shape at all.
      expect(() => completeTask(blocked.path, tasksDir)).toThrow('Unresolved blocker');
    });

    it('allows finalizing as WONTFIX with an unresolved blocker, without --force', () => {
      const blocker = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Blocker',
        reporter: 'USER',
      });
      const blocked = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Blocked',
        reporter: 'USER',
        blockedBy: [blocker.key],
      });
      // Force through the NEEDS REVIEW setup step -- the blocker is still unresolved at
      // this point too, and that's not what this test is exercising.
      completeTask(blocked.path, tasksDir, false, undefined, true);

      expect(() => completeTask(blocked.path, tasksDir, true, 'WONTFIX')).not.toThrow();
      expect(readTaskFrontmatter(blocked.path).status).toBe('COMPLETE');
      expect(readTaskFrontmatter(blocked.path).resolution).toBe('WONTFIX');
    });

    it('still blocks finalizing as DONE with an unresolved blocker (WONTFIX exemption does not leak to DONE)', () => {
      const blocker = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Blocker',
        reporter: 'USER',
      });
      const blocked = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Blocked',
        reporter: 'USER',
        blockedBy: [blocker.key],
      });
      completeTask(blocked.path, tasksDir, false, undefined, true);

      expect(() => completeTask(blocked.path, tasksDir, true, 'DONE')).toThrow('Unresolved blocker');
    });
  });

  describe('check 3: dangling relationship references', () => {
    it('blocks creating a task with a blockedBy key that does not exist', () => {
      expect(() =>
        createTask(tasksDir, {
          project: 'CON',
          kind: 'TASK',
          priority: 'HIGH',
          title: 'Task',
          reporter: 'USER',
          blockedBy: ['CON-999'],
        }),
      ).toThrow('not found');
    });

    it('allows creating with a dangling reference when forced', () => {
      expect(() =>
        createTask(tasksDir, {
          project: 'CON',
          kind: 'TASK',
          priority: 'HIGH',
          title: 'Task',
          reporter: 'USER',
          blockedBy: ['CON-999'],
          force: true,
        }),
      ).not.toThrow();
    });

    it('blocks updating dependsOn to a key that does not exist', () => {
      const task = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Task',
        reporter: 'USER',
      });

      expect(() => updateTaskFields(task.path, { dependsOn: ['CON-999'] }, tasksDir)).toThrow('not found');
    });

    it('allows a relationship field pointing at a real task', () => {
      const other = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Other',
        reporter: 'USER',
      });
      const task = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Task',
        reporter: 'USER',
      });

      expect(() => updateTaskFields(task.path, { related: [other.key] }, tasksDir)).not.toThrow();
    });
  });

  describe('check 4: cycle detection', () => {
    it('blocks a task listing itself as its own blocker', () => {
      const task = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Task',
        reporter: 'USER',
      });

      expect(() => updateTaskFields(task.path, { blockedBy: [task.key] }, tasksDir)).toThrow('cycle');
    });

    it('blocks a two-hop cycle across dependsOn', () => {
      const a = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'A',
        reporter: 'USER',
      });
      const b = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'B',
        reporter: 'USER',
        dependsOn: [a.key],
      });

      expect(() => updateTaskFields(a.path, { dependsOn: [b.key] }, tasksDir)).toThrow('cycle');
    });

    it('allows a cycle when forced', () => {
      const task = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Task',
        reporter: 'USER',
      });

      expect(() => updateTaskFields(task.path, { blockedBy: [task.key] }, tasksDir, true)).not.toThrow();
    });

    it('allows a non-cyclic dependency chain', () => {
      const a = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'A',
        reporter: 'USER',
      });
      const b = createTask(tasksDir, {
        project: 'CON',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'B',
        reporter: 'USER',
      });

      expect(() => updateTaskFields(b.path, { dependsOn: [a.key] }, tasksDir)).not.toThrow();
    });
  });
});

describe('counter allocation', () => {
  let tasksDir: string;

  beforeEach(() => {
    tasksDir = mkdtempSync(join(tmpdir(), 'counter-alloc-test-'));
    createProject(tasksDir, 'FOO');
  });

  afterEach(() => {
    rmSync(tasksDir, { recursive: true, force: true });
  });

  it('should allocate highest-on-disk+1 even when a stale index has a lower counter', () => {
    // Arrange: create FOO-1, build index (counter = 2), then add FOO-5 out-of-band
    createTask(tasksDir, { project: 'FOO', kind: 'TASK', priority: 'HIGH', title: 'First', reporter: 'USER' });
    updateIndex(tasksDir); // counter locked at 2
    writeFileSync(
      join(tasksDir, 'FOO', 'FOO-5.md'),
      '---\ntitle: "Out of band"\nstatus: NOT STARTED\nkind: TASK\npriority: LOW\nassignee: UNASSIGNED\nreporter: USER\ncreated_at: 2026-03-21T10:00:00Z\nupdated_at: 2026-03-21T10:00:00Z\n---\n\n# Out of band\n',
    );

    // Act: create next task — index says 2, disk says highest is 5
    const result = createTask(tasksDir, {
      project: 'FOO',
      kind: 'TASK',
      priority: 'MEDIUM',
      title: 'After sync',
      reporter: 'USER',
    });

    // Assert: disk scan wins → FOO-6
    expect(result.key).toBe('FOO-6');
  });

  it('should not reuse a number that has a .moved tombstone', () => {
    // Arrange: FOO-1 and FOO-2 exist, FOO-2 gets a .moved tombstone (simulates cross-project move)
    createTask(tasksDir, { project: 'FOO', kind: 'TASK', priority: 'HIGH', title: 'T1', reporter: 'USER' });
    createTask(tasksDir, { project: 'FOO', kind: 'TASK', priority: 'HIGH', title: 'T2', reporter: 'USER' });
    rmSync(join(tasksDir, 'FOO', 'FOO-2.md'));
    writeFileSync(join(tasksDir, 'FOO', 'FOO-2.moved'), '');

    // Act: no index; disk scan must pick up the tombstone
    const result = createTask(tasksDir, {
      project: 'FOO',
      kind: 'TASK',
      priority: 'MEDIUM',
      title: 'After move',
      reporter: 'USER',
    });

    // Assert: FOO-2 is not reused; highest on disk (via tombstone) is 2 → allocate FOO-3
    expect(result.key).toBe('FOO-3');
  });

  it('should use index counter as floor when disk scan finds a lower number', () => {
    // Arrange: create FOO-1 through FOO-3, build index (counter = 4),
    // then delete FOO-3 out-of-band (spec prohibits deletion, but be defensive)
    createTask(tasksDir, { project: 'FOO', kind: 'TASK', priority: 'HIGH', title: 'T1', reporter: 'USER' });
    createTask(tasksDir, { project: 'FOO', kind: 'TASK', priority: 'HIGH', title: 'T2', reporter: 'USER' });
    createTask(tasksDir, { project: 'FOO', kind: 'TASK', priority: 'HIGH', title: 'T3', reporter: 'USER' });
    updateIndex(tasksDir); // counter locked at 4
    rmSync(join(tasksDir, 'FOO', 'FOO-3.md'));

    // Act: disk scan finds highest = 2 → would return 3; index floor = 4
    const result = createTask(tasksDir, {
      project: 'FOO',
      kind: 'TASK',
      priority: 'MEDIUM',
      title: 'After deletion',
      reporter: 'USER',
    });

    // Assert: index floor wins → FOO-4 (no counter regression)
    expect(result.key).toBe('FOO-4');
  });
});

describe('writeTaskFileAuditably', () => {
  let tasksDir: string;

  beforeEach(() => {
    tasksDir = mkdtempSync(join(tmpdir(), 'audited-write-test-'));
    createProject(tasksDir, 'AUD');
  });

  afterEach(() => {
    rmSync(tasksDir, { recursive: true, force: true });
  });

  it('writes content to disk and appends activity log entry', () => {
    const result = createTask(tasksDir, {
      project: 'AUD',
      kind: 'TASK',
      priority: 'MEDIUM',
      title: 'Test task',
      reporter: 'USER',
    });
    const taskPath = result.path;
    const originalContent = readFileSync(taskPath, 'utf-8');

    const newContent = originalContent.replace('NOT STARTED', 'IN PROGRESS');
    const changes = [{ field: 'status', from: 'NOT STARTED', to: 'IN PROGRESS' }];

    writeTaskFileAuditably({ taskPath, tasksDir, originalContent, newContent, changes });

    const updatedContent = readFileSync(taskPath, 'utf-8');
    expect(updatedContent).toContain('IN PROGRESS');
    expect(updatedContent).toContain('# Activity Log');
    expect(updatedContent).toContain('status');
    expect(updatedContent).toContain('NOT STARTED → IN PROGRESS');
  });

  it('writes a history diff when content changes', () => {
    const result = createTask(tasksDir, {
      project: 'AUD',
      kind: 'TASK',
      priority: 'MEDIUM',
      title: 'Test task',
      reporter: 'USER',
    });
    const taskPath = result.path;
    const originalContent = readFileSync(taskPath, 'utf-8');

    const newContent = originalContent.replace('NOT STARTED', 'IN PROGRESS');
    const changes = [{ field: 'status', from: 'NOT STARTED', to: 'IN PROGRESS' }];

    writeTaskFileAuditably({ taskPath, tasksDir, originalContent, newContent, changes });

    // History diff should exist
    const historyDir = join(tasksDir, 'history', result.key);
    expect(existsSync(historyDir)).toBe(true);
    const diffFileName = readdirSync(historyDir).find((f) => f.endsWith('.diff'));
    expect(diffFileName).toBeDefined();
    const diffContent = readFileSync(join(historyDir, diffFileName!), 'utf-8');
    expect(diffContent).toContain('IN PROGRESS');
  });

  it('does not write activity or diff when content is unchanged and no changes', () => {
    const result = createTask(tasksDir, {
      project: 'AUD',
      kind: 'TASK',
      priority: 'MEDIUM',
      title: 'Test task',
      reporter: 'USER',
    });
    const taskPath = result.path;
    const originalContent = readFileSync(taskPath, 'utf-8');

    writeTaskFileAuditably({ taskPath, tasksDir, originalContent, newContent: originalContent, changes: [] });

    const contentAfter = readFileSync(taskPath, 'utf-8');
    // Content should be unchanged — no activity log appended
    expect(contentAfter).toBe(originalContent);
  });

  it('appends activity log even when new content matches old content (e.g. activity-only change)', () => {
    // Edge case: if someone passes changes but content didn't differ,
    // we still want the activity log to reflect the declared changes
    const result = createTask(tasksDir, {
      project: 'AUD',
      kind: 'TASK',
      priority: 'MEDIUM',
      title: 'Test task',
      reporter: 'USER',
    });
    const taskPath = result.path;
    const originalContent = readFileSync(taskPath, 'utf-8');

    const changes = [{ field: 'references', from: undefined, to: 'updated' }];
    writeTaskFileAuditably({ taskPath, tasksDir, originalContent, newContent: originalContent, changes });

    const contentAfter = readFileSync(taskPath, 'utf-8');
    expect(contentAfter).toContain('# Activity Log');
  });

  it('uses historyKey override for history directory when provided', () => {
    const result = createTask(tasksDir, {
      project: 'AUD',
      kind: 'TASK',
      priority: 'MEDIUM',
      title: 'Test task',
      reporter: 'USER',
    });
    const taskPath = result.path;
    const originalContent = readFileSync(taskPath, 'utf-8');

    const newContent = originalContent.replace('NOT STARTED', 'IN PROGRESS');
    const changes = [{ field: 'key', from: 'AUD-1', to: 'MOV-1' }];

    // Write with historyKey override — diff should land under the old key
    writeTaskFileAuditably({
      taskPath,
      tasksDir,
      originalContent,
      newContent,
      changes,
      historyKey: 'AUD-1',
    });

    const historyDir = join(tasksDir, 'history', 'AUD-1');
    expect(existsSync(historyDir)).toBe(true);
    const diffFileName = readdirSync(historyDir).find((f) => f.endsWith('.diff'));
    expect(diffFileName).toBeDefined();
  });
});
