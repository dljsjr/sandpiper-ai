import { describe, expect, it } from 'vitest';
import { parseFrontmatter, taskFromFrontmatter } from './frontmatter.js';

describe('parseFrontmatter', () => {
  it('should parse simple key-value pairs', () => {
    const content = `---
title: My Task
status: IN PROGRESS
kind: TASK
---

# My Task
`;
    const fm = parseFrontmatter(content);
    expect(fm.title).toBe('My Task');
    expect(fm.status).toBe('IN PROGRESS');
    expect(fm.kind).toBe('TASK');
  });

  it('should strip surrounding double quotes from values', () => {
    const content = `---
title: "Quoted title"
---
`;
    const fm = parseFrontmatter(content);
    expect(fm.title).toBe('Quoted title');
  });

  it('should unescape JSON-compatible double-quoted values', () => {
    const content = `---
title: "Quoted \\"title\\""
---
`;
    const fm = parseFrontmatter(content);
    expect(fm.title).toBe('Quoted "title"');
  });

  it('should keep the first value when frontmatter contains duplicate keys', () => {
    const content = `---
title: "Duplicate test"
status: NOT STARTED
reporter: Piper
status: COMPLETE
---
`;
    const fm = parseFrontmatter(content);
    expect(fm.status).toBe('NOT STARTED');
  });

  it('should parse arrays with dash syntax', () => {
    const content = `---
title: Task
depends_on:
  - SHR-1
  - SHR-2
  - SHR-3
---
`;
    const fm = parseFrontmatter(content);
    expect(fm.depends_on).toEqual(['SHR-1', 'SHR-2', 'SHR-3']);
  });

  it('should handle multiple arrays', () => {
    const content = `---
title: Task
depends_on:
  - SHR-1
blocked_by:
  - SHR-4
related:
  - SHR-5
  - SHR-6
---
`;
    const fm = parseFrontmatter(content);
    expect(fm.depends_on).toEqual(['SHR-1']);
    expect(fm.blocked_by).toEqual(['SHR-4']);
    expect(fm.related).toEqual(['SHR-5', 'SHR-6']);
  });

  it('should return empty object for content without frontmatter', () => {
    const content = '# Just a heading\n\nSome text.\n';
    const fm = parseFrontmatter(content);
    expect(fm).toEqual({});
  });

  it('should handle all required task fields', () => {
    const content = `---
title: "Full task"
status: NEEDS REVIEW
kind: BUG
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-03-20T15:00:00Z
updated_at: 2026-03-21T10:00:00-05:00
---
`;
    const fm = parseFrontmatter(content);
    expect(fm.title).toBe('Full task');
    expect(fm.status).toBe('NEEDS REVIEW');
    expect(fm.kind).toBe('BUG');
    expect(fm.priority).toBe('HIGH');
    expect(fm.assignee).toBe('AGENT');
    expect(fm.reporter).toBe('USER');
    expect(fm.created_at).toBe('2026-03-20T15:00:00Z');
    expect(fm.updated_at).toBe('2026-03-21T10:00:00-05:00');
  });

  it('should handle empty arrays', () => {
    const content = `---
title: Task
depends_on:
status: NOT STARTED
---
`;
    const fm = parseFrontmatter(content);
    // An empty array key followed by another key should produce empty array
    expect(fm.depends_on).toEqual([]);
    expect(fm.status).toBe('NOT STARTED');
  });

  it('should parse YAML failsafe scalars without coercion', () => {
    const content = `---
title: NO
assignee: Yes
priority: 00123
reporter: null
created_at: 2026-06-13
---
`;

    const fm = parseFrontmatter(content);

    expect(fm.title).toBe('NO');
    expect(fm.assignee).toBe('Yes');
    expect(fm.priority).toBe('00123');
    expect(fm.reporter).toBe('null');
    expect(fm.created_at).toBe('2026-06-13');
  });

  it('should parse flow arrays as string arrays', () => {
    const content = `---
title: Flow arrays
depends_on: [SHR-1, SHR-2]
---
`;

    const fm = parseFrontmatter(content);

    expect(fm.depends_on).toEqual(['SHR-1', 'SHR-2']);
  });

  it('should parse block scalars as strings', () => {
    const content = `---
title: |
  Multi-line
  title
---
`;

    const fm = parseFrontmatter(content);

    expect(fm.title).toBe('Multi-line\ntitle\n');
  });
});

describe('taskFromFrontmatter', () => {
  it('returns a structurally complete task with defaults for missing fields', () => {
    const task = taskFromFrontmatter('TCL-123', { title: 'Minimal task' });

    expect(task).toEqual({
      key: 'TCL-123',
      project: 'TCL',
      title: 'Minimal task',
      status: 'NOT STARTED',
      kind: 'TASK',
      priority: 'MEDIUM',
      assignee: 'UNASSIGNED',
      reporter: 'USER',
      createdAt: '',
      updatedAt: '',
      dependsOn: [],
      blockedBy: [],
      related: [],
    });
  });

  it('preserves freeform assignee and reporter values', () => {
    const task = taskFromFrontmatter('TCL-124', {
      title: 'Freeform people fields',
      assignee: 'Doug Stephen',
      reporter: 'Piper (Librarian)',
    });

    expect(task.assignee).toBe('Doug Stephen');
    expect(task.reporter).toBe('Piper (Librarian)');
  });

  it('canonicalizes conventional assignee and reporter values case-insensitively', () => {
    const task = taskFromFrontmatter('TCL-125', {
      title: 'Canonical people fields',
      assignee: 'agent',
      reporter: 'user',
    });

    expect(task.assignee).toBe('AGENT');
    expect(task.reporter).toBe('USER');
  });

  it('falls back to default enum values for malformed frontmatter', () => {
    const task = taskFromFrontmatter('TCL-124', {
      status: 'BOGUS',
      kind: 'FEATURE',
      priority: 'URGENT',
      resolution: 'MAYBE',
    });

    expect(task.status).toBe('NOT STARTED');
    expect(task.kind).toBe('TASK');
    expect(task.priority).toBe('MEDIUM');
    expect(task.resolution).toBeUndefined();
  });

  it('coerces scalar strings for array fields into single-element arrays', () => {
    const task = taskFromFrontmatter('TCL-200', {
      title: 'Scalar array fields',
      depends_on: 'SHR-1',
      blocked_by: 'SHR-2',
      related: 'SHR-3',
    });

    expect(task.dependsOn).toEqual(['SHR-1']);
    expect(task.blockedBy).toEqual(['SHR-2']);
    expect(task.related).toEqual(['SHR-3']);
  });
});
