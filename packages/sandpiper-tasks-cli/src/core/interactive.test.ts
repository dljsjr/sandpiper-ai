import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractDescription, replaceDescription } from './description.js';
import { parseFrontmatter } from './frontmatter.js';
import { createProject, createTask, updateTaskFields } from './mutate.js';

describe('Description operations', () => {
  let tasksDir: string;

  beforeEach(() => {
    tasksDir = mkdtempSync(join(tmpdir(), 'desc-test-'));
    createProject(tasksDir, 'FOO');
  });

  afterEach(() => {
    rmSync(tasksDir, { recursive: true, force: true });
  });

  describe('extractDescription', () => {
    it('should extract body text after the heading', () => {
      const { path } = createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'My task',
        reporter: 'USER',
      });

      // Default task has empty body — just heading + blank line
      const content = readFileSync(path, 'utf-8');
      const desc = extractDescription(content);
      expect(desc.trim()).toBe('');
    });

    it('should extract multi-line description', () => {
      const content = `---
title: "Test"
status: NOT STARTED
---

# Test

This is the description.

It has multiple paragraphs.

- And a list
`;
      const desc = extractDescription(content);
      expect(desc).toContain('This is the description.');
      expect(desc).toContain('multiple paragraphs');
      expect(desc).toContain('- And a list');
    });
  });

  describe('replaceDescription', () => {
    it('should replace the body while preserving frontmatter and heading', () => {
      const content = `---
title: "Test"
status: NOT STARTED
kind: TASK
---

# Test

Old description.
`;
      const updated = replaceDescription(content, 'New description.\n\nWith paragraphs.\n');
      expect(updated).toContain('title: "Test"');
      expect(updated).toContain('# Test');
      expect(updated).toContain('New description.');
      expect(updated).toContain('With paragraphs.');
      expect(updated).not.toContain('Old description');
    });

    it('should handle empty description', () => {
      const content = `---
title: "Test"
status: NOT STARTED
---

# Test

Some content.
`;
      const updated = replaceDescription(content, '');
      expect(updated).toContain('# Test');
      expect(updated).not.toContain('Some content');
    });
  });

  describe('updateTaskFields with description', () => {
    it('should update description via updateTaskFields', () => {
      const { path } = createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Desc test',
        reporter: 'USER',
      });

      updateTaskFields(path, {
        description: 'Added via CLI.\n\nMore details.\n',
      });
      const content = readFileSync(path, 'utf-8');
      expect(content).toContain('Added via CLI.');
      expect(content).toContain('More details.');
    });

    it('should update description alongside other fields', () => {
      const { path } = createTask(tasksDir, {
        project: 'FOO',
        kind: 'TASK',
        priority: 'HIGH',
        title: 'Multi update',
        reporter: 'USER',
      });

      updateTaskFields(path, {
        status: 'IN PROGRESS',
        assignee: 'AGENT',
        description: 'Now with a description.\n',
      });

      const fm = parseFrontmatter(readFileSync(path, 'utf-8'));
      expect(fm.status).toBe('IN PROGRESS');
      expect(fm.assignee).toBe('AGENT');
      const content = readFileSync(path, 'utf-8');
      expect(content).toContain('Now with a description.');
    });
  });
});
