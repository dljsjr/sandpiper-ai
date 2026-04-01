import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from '@commander-js/extra-typings';
import { afterEach, describe, expect, it } from 'vitest';
import { createProject, createTask, updateTaskFields } from '../core/mutate.js';
import {
  applyInteractiveFieldUpdates,
  buildFieldsFromOptions,
  normalizeStatus,
  resolveTargetPaths,
} from './task-cmd-helpers.js';

const tempDirs: string[] = [];

function setupTasksDir(): { rootDir: string; tasksDir: string } {
  const rootDir = mkdtempSync(join(tmpdir(), 'task-cmd-helpers-'));
  const tasksDir = join(rootDir, '.sandpiper', 'tasks');
  tempDirs.push(rootDir);

  createProject(tasksDir, 'AGENT');
  createTask(tasksDir, {
    project: 'AGENT',
    kind: 'TASK',
    priority: 'HIGH',
    title: 'Primary task',
    reporter: 'USER',
  });
  createTask(tasksDir, {
    project: 'AGENT',
    kind: 'TASK',
    priority: 'MEDIUM',
    title: 'Secondary task',
    reporter: 'USER',
  });

  return { rootDir, tasksDir };
}

function createRootCommand(rootDir: string): Parameters<typeof resolveTargetPaths>[2] {
  const command = new Command().option('-d, --dir <path>').option('-f, --format <format>').option('--no-save');
  command.setOptionValue('dir', rootDir);
  return command;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('task-cmd-helpers', () => {
  it('normalizes status values and parses update option fields', () => {
    const fields = buildFieldsFromOptions({
      status: 'in_progress',
      assignee: 'agent',
      priority: 'high',
      resolution: 'done',
      reporter: 'user',
      dependsOn: 'AGENT-1, AGENT-2',
      blockedBy: '',
      related: 'TCL-1',
      desc: 'updated description',
    });

    expect(normalizeStatus('needs_review')).toBe('NEEDS REVIEW');
    expect(fields).toMatchObject({
      status: 'IN PROGRESS',
      assignee: 'AGENT',
      priority: 'HIGH',
      resolution: 'DONE',
      reporter: 'USER',
      description: 'updated description',
      dependsOn: ['AGENT-1', 'AGENT-2'],
      blockedBy: [],
      related: ['TCL-1'],
    });
  });

  it('applies interactive updates and rewrites task descriptions', () => {
    const original = `---
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
Old body
`;

    const updated = applyInteractiveFieldUpdates(original, {
      status: 'IN PROGRESS',
      description: 'New body text',
    });

    expect(updated).toContain('status: IN PROGRESS');
    expect(updated).toContain('# Example');
    expect(updated).toContain('New body text');
    expect(updated).not.toContain('Old body');
  });

  it('resolves bulk target paths from project/status filters', () => {
    const { rootDir, tasksDir } = setupTasksDir();
    updateTaskFields(join(tasksDir, 'AGENT', 'AGENT-2.md'), {
      status: 'IN PROGRESS',
    });

    const paths = resolveTargetPaths(
      undefined,
      {
        project: 'AGENT',
        filterStatus: 'IN_PROGRESS',
      },
      createRootCommand(rootDir),
      tasksDir,
    );

    expect(paths).toEqual([join(tasksDir, 'AGENT', 'AGENT-2.md')]);
  });

  it('throws when bulk filters match no tasks', () => {
    const { rootDir, tasksDir } = setupTasksDir();

    expect(() =>
      resolveTargetPaths(
        undefined,
        {
          project: 'AGENT',
          filterStatus: 'COMPLETE',
        },
        createRootCommand(rootDir),
        tasksDir,
      ),
    ).toThrow('No tasks matched the given filters.');
  });
});
