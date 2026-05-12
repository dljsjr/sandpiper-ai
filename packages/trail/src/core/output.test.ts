import { decode } from '@toon-format/toon';
import { describe, expect, it } from 'vitest';
import { extractFrontmatter, formatRawOutput, formatTasksOutput } from './output.js';
import type { Task } from './types.js';

function makeTask(overrides: Partial<Task> & { key: string }): Task {
  return {
    project: overrides.key.split('-')[0] ?? 'TST',
    title: `Task ${overrides.key}`,
    status: 'NOT STARTED',
    kind: 'TASK',
    priority: 'MEDIUM',
    assignee: 'UNASSIGNED',
    reporter: 'USER',
    createdAt: '2026-03-20T15:00:00Z',
    updatedAt: '2026-03-20T15:00:00Z',
    dependsOn: [],
    blockedBy: [],
    related: [],
    ...overrides,
  };
}

const TASKS: readonly Task[] = [
  makeTask({
    key: 'FOO-1',
    title: 'First',
    status: 'IN PROGRESS',
    assignee: 'AGENT',
  }),
  makeTask({
    key: 'FOO-2',
    title: 'Second',
    priority: 'HIGH',
    dependsOn: ['FOO-1'],
  }),
];

describe('formatTasksOutput', () => {
  describe('json format', () => {
    it('should produce valid JSON array', () => {
      const output = formatTasksOutput(TASKS, 'json');
      const parsed = JSON.parse(output);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
    });

    it('should include all task fields', () => {
      const output = formatTasksOutput(TASKS, 'json');
      const parsed = JSON.parse(output) as Task[];
      expect(parsed[0]?.key).toBe('FOO-1');
      expect(parsed[0]?.status).toBe('IN PROGRESS');
      expect(parsed[0]?.assignee).toBe('AGENT');
      expect(parsed[1]?.dependsOn).toEqual(['FOO-1']);
    });

    it('should handle a single task', () => {
      const output = formatTasksOutput([TASKS[0]!], 'json');
      const parsed = JSON.parse(output);
      expect(parsed).toHaveLength(1);
    });

    it('should handle empty array', () => {
      const output = formatTasksOutput([], 'json');
      expect(JSON.parse(output)).toEqual([]);
    });
  });

  describe('toon format', () => {
    it('should produce valid TOON that decodes to an array', () => {
      const output = formatTasksOutput(TASKS, 'toon');
      const parsed = decode(output);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it('should include all task fields', () => {
      const output = formatTasksOutput(TASKS, 'toon');
      const parsed = decode(output) as unknown as Task[];
      expect(parsed[0]?.key).toBe('FOO-1');
      expect(parsed[1]?.dependsOn).toEqual(['FOO-1']);
    });
  });
});

describe('formatRawOutput', () => {
  it('should concatenate file contents with separators', () => {
    const files = [
      { path: 'FOO-1.md', content: '---\ntitle: First\n---\n\n# First\n' },
      { path: 'FOO-2.md', content: '---\ntitle: Second\n---\n\n# Second\n' },
    ];
    const output = formatRawOutput(files);
    expect(output).toContain('title: First');
    expect(output).toContain('title: Second');
    expect(output).toContain('FOO-1.md');
  });

  it('should output single file without separator', () => {
    const files = [{ path: 'FOO-1.md', content: '---\ntitle: Only\n---\n\n# Only\n' }];
    const output = formatRawOutput(files);
    expect(output).toContain('title: Only');
    expect(output).not.toContain('───');
  });
});

describe('extractFrontmatter', () => {
  const FULL_TASK = `---
title: "My Task"
status: IN PROGRESS
kind: TASK
priority: HIGH
---

# My Task

This is the body content.

---

# Activity Log

## 2026-03-20T10:00:00Z

- **status**: NOT STARTED → IN PROGRESS
`;

  it('should return only the frontmatter block', () => {
    const result = extractFrontmatter(FULL_TASK);
    expect(result).toContain('title: "My Task"');
    expect(result).toContain('status: IN PROGRESS');
    expect(result).not.toContain('# My Task');
    expect(result).not.toContain('This is the body content');
    expect(result).not.toContain('Activity Log');
  });

  it('should include both opening and closing --- delimiters', () => {
    const result = extractFrontmatter(FULL_TASK);
    const lines = result.split('\n');
    expect(lines[0]).toBe('---');
    expect(lines.at(-2)).toBe('---');
  });

  it('should return content unchanged when no frontmatter is present', () => {
    const content = '# Just a heading\n\nSome content.\n';
    expect(extractFrontmatter(content)).toBe(content);
  });

  it('should handle a file with only frontmatter and no body', () => {
    const content = '---\ntitle: "Minimal"\nstatus: NOT STARTED\n---\n';
    const result = extractFrontmatter(content);
    expect(result).toContain('title: "Minimal"');
    expect(result).not.toContain('# Minimal');
  });
});
