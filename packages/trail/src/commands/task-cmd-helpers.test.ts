import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from '@commander-js/extra-typings';
import { afterEach, describe, expect, it } from 'vitest';
import { createProject, createTask, updateTaskFields } from '../core/mutate.js';
import type { Task } from '../core/types.js';
import {
  applyInteractiveFieldUpdates,
  buildFieldsFromOptions,
  diffGuardRelevantFields,
  normalizeStatus,
  resolveTargetPaths,
} from './task-cmd-helpers.js';

function fixtureTask(overrides: Partial<Task> = {}): Task {
  return {
    key: 'FOO-1',
    project: 'FOO',
    title: 'Task',
    status: 'NOT STARTED',
    kind: 'TASK',
    priority: 'MEDIUM',
    assignee: 'UNASSIGNED',
    reporter: 'USER',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    dependsOn: [],
    blockedBy: [],
    related: [],
    ...overrides,
  };
}

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
  const command = new Command().option('-d, --dir <path>').option('-f, --format <format>');
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
      assignee: 'Doug Stephen',
      priority: 'high',
      resolution: 'done',
      reporter: 'Piper (Librarian)',
      dependsOn: 'AGENT-1, AGENT-2',
      blockedBy: '',
      related: 'TCL-1',
      desc: 'updated description',
    });

    expect(normalizeStatus('needs_review')).toBe('NEEDS REVIEW');
    expect(fields).toMatchObject({
      status: 'IN PROGRESS',
      assignee: 'Doug Stephen',
      priority: 'HIGH',
      resolution: 'DONE',
      reporter: 'Piper (Librarian)',
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
    updateTaskFields(
      join(tasksDir, 'AGENT', 'AGENT-2.md'),
      {
        status: 'IN PROGRESS',
      },
      tasksDir,
    );

    const paths = resolveTargetPaths(
      undefined,
      {
        project: 'AGENT',
        filterStatus: 'IN_PROGRESS',
        bulk: true,
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
          bulk: true,
        },
        createRootCommand(rootDir),
        tasksDir,
      ),
    ).toThrow('No tasks matched the given filters.');
  });

  it('throws when writing bulk mutations without explicit --bulk', () => {
    const { rootDir, tasksDir } = setupTasksDir();

    expect(() =>
      resolveTargetPaths(
        undefined,
        {
          project: 'AGENT',
        },
        createRootCommand(rootDir),
        tasksDir,
      ),
    ).toThrow(/matched 2 tasks and requires --bulk/);
  });

  it('resolves bulk target paths when bulk intent is explicit', () => {
    const { rootDir, tasksDir } = setupTasksDir();

    const paths = resolveTargetPaths(
      undefined,
      {
        project: 'AGENT',
        bulk: true,
      },
      createRootCommand(rootDir),
      tasksDir,
    );

    expect(paths.length).toBeGreaterThan(0);
  });
});

describe('diffGuardRelevantFields', () => {
  it('returns nothing when none of the guard-relevant fields changed', () => {
    const original = fixtureTask();
    const edited = fixtureTask({ title: 'Renamed' });

    expect(diffGuardRelevantFields(original, edited)).toEqual({});
  });

  it('includes status only when it changed', () => {
    const original = fixtureTask({ status: 'NOT STARTED' });
    const edited = fixtureTask({ status: 'IN PROGRESS' });

    expect(diffGuardRelevantFields(original, edited)).toEqual({ status: 'IN PROGRESS' });
  });

  it('includes blockedBy only when it changed', () => {
    const original = fixtureTask({ blockedBy: ['FOO-2'] });
    const edited = fixtureTask({ blockedBy: ['FOO-2', 'FOO-3'] });

    expect(diffGuardRelevantFields(original, edited)).toEqual({ blockedBy: ['FOO-2', 'FOO-3'] });
  });

  it('treats reordering a relation array as a change (order is significant)', () => {
    const original = fixtureTask({ related: ['FOO-2', 'FOO-3'] });
    const edited = fixtureTask({ related: ['FOO-3', 'FOO-2'] });

    expect(diffGuardRelevantFields(original, edited)).toEqual({ related: ['FOO-3', 'FOO-2'] });
  });

  it('includes multiple changed fields together', () => {
    const original = fixtureTask({ status: 'NOT STARTED', dependsOn: [] });
    const edited = fixtureTask({ status: 'NEEDS REVIEW', dependsOn: ['FOO-9'] });

    expect(diffGuardRelevantFields(original, edited)).toEqual({
      status: 'NEEDS REVIEW',
      dependsOn: ['FOO-9'],
    });
  });

  it('includes resolution only when it changed, so an interactive WONTFIX picks up the check-2 exemption', () => {
    const original = fixtureTask({ status: 'NEEDS REVIEW' });
    const edited = fixtureTask({ status: 'COMPLETE', resolution: 'WONTFIX' });

    expect(diffGuardRelevantFields(original, edited)).toEqual({
      status: 'COMPLETE',
      resolution: 'WONTFIX',
    });
  });
});
