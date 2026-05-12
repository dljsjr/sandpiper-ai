import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from '@commander-js/extra-typings';
import { encode } from '@toon-format/toon';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProject, createTask, updateTaskFields } from '../core/mutate.js';
import { taskCommand } from './task-cmd.js';

const tempDirs: string[] = [];

function setupTasksDir(): { rootDir: string; tasksDir: string } {
  const rootDir = mkdtempSync(join(tmpdir(), 'task-subcommands-'));
  const tasksDir = join(rootDir, '.sandpiper', 'tasks');
  tempDirs.push(rootDir);

  createProject(tasksDir, 'AGENT');
  createProject(tasksDir, 'TOOLS');

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
    title: 'Archive target',
    reporter: 'USER',
  });

  return { rootDir, tasksDir };
}

async function runTaskCommand(
  rootDir: string,
  args: readonly string[],
): Promise<{ stdout: string; stderr: string; exitCode: string | number | null | undefined }> {
  const logs: string[] = [];
  const errors: string[] = [];
  const logSpy = vi.spyOn(console, 'log').mockImplementation((...items: unknown[]) => {
    logs.push(items.join(' '));
  });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation((...items: unknown[]) => {
    errors.push(items.join(' '));
  });

  try {
    process.exitCode = 0;
    const program = new Command()
      .name('trail')
      .option('-d, --dir <path>')
      .option('-f, --format <format>')
      .option('--no-save')
      .addCommand(taskCommand);

    await program.parseAsync(['-d', rootDir, 'task', ...args], { from: 'user' });
  } finally {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  }

  return { stdout: logs.join('\n'), stderr: errors.join('\n'), exitCode: process.exitCode };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

describe('task subcommands (happy paths)', () => {
  it('list', async () => {
    const { rootDir } = setupTasksDir();
    const result = await runTaskCommand(rootDir, ['list']);
    expect(result.stdout).toContain('AGENT-1');
  });

  it('show', async () => {
    const { rootDir } = setupTasksDir();
    const result = await runTaskCommand(rootDir, ['show', 'AGENT-1']);
    expect(result.stdout).toContain('AGENT-1: Primary task');
  });

  it('summary', async () => {
    const { rootDir } = setupTasksDir();
    const result = await runTaskCommand(rootDir, ['summary']);
    expect(result.stdout).toContain('Total: 2 tasks');
  });

  it('create', async () => {
    const { rootDir } = setupTasksDir();
    const result = await runTaskCommand(rootDir, ['create', '-p', 'AGENT', '-t', 'Created from test']);
    expect(result.stdout).toContain('Created AGENT-3: Created from test');
  });

  it('create with description', async () => {
    const { rootDir, tasksDir } = setupTasksDir();
    const result = await runTaskCommand(rootDir, [
      'create',
      '-p',
      'AGENT',
      '-t',
      'Created with description',
      '--desc',
      'Detailed task body',
    ]);

    expect(result.stdout).toContain('Created AGENT-3: Created with description');
    expect(readFileSync(join(tasksDir, 'AGENT', 'AGENT-3.md'), 'utf-8')).toContain(
      '# Created with description\n\nDetailed task body\n',
    );
  });

  it('rejects invalid subtask parent keys before creating directories', async () => {
    const { rootDir, tasksDir } = setupTasksDir();
    const result = await runTaskCommand(rootDir, [
      'create',
      '-p',
      'AGENT',
      '-t',
      'Invalid subtask',
      '--kind',
      'SUBTASK',
      '--parent',
      'AGENT-1\nAGENT-2',
    ]);

    expect(result.stderr).toContain('Invalid parent task key');
    expect(result.exitCode).toBe(1);
    expect(existsSync(join(tasksDir, 'AGENT', 'AGENT-1\nAGENT-2'))).toBe(false);
  });

  it('search defaults to relevance sort and applies limit before task sorting', async () => {
    const { rootDir, tasksDir } = setupTasksDir();
    createTask(tasksDir, {
      project: 'AGENT',
      kind: 'TASK',
      priority: 'HIGH',
      title: 'Dense search match',
      reporter: 'USER',
      description: 'needle needle needle needle needle',
    });
    createTask(tasksDir, {
      project: 'AGENT',
      kind: 'TASK',
      priority: 'LOW',
      title: 'Sparse search match',
      reporter: 'USER',
      description: 'needle',
    });

    const result = await runTaskCommand(rootDir, ['list', '-q', 'needle', '--limit', '1']);
    expect(result.stdout).toContain('AGENT-3');
    expect(result.stdout).not.toContain('AGENT-4');
  });

  it('search honors explicit sort after applying search limit', async () => {
    const { rootDir, tasksDir } = setupTasksDir();
    createTask(tasksDir, {
      project: 'AGENT',
      kind: 'TASK',
      priority: 'HIGH',
      title: 'Dense search match',
      reporter: 'USER',
      description: 'needle needle needle needle needle',
    });
    createTask(tasksDir, {
      project: 'AGENT',
      kind: 'TASK',
      priority: 'LOW',
      title: 'Sparse search match',
      reporter: 'USER',
      description: 'needle',
    });

    const result = await runTaskCommand(rootDir, ['list', '-q', 'needle', '--limit', '2', '--sort', 'priority']);
    expect(result.stdout.indexOf('AGENT-4')).toBeLessThan(result.stdout.indexOf('AGENT-3'));
  });

  it('rejects relevance sort without search', async () => {
    const { rootDir } = setupTasksDir();
    const result = await runTaskCommand(rootDir, ['list', '--sort', 'relevance']);

    expect(result.stderr).toContain('--sort relevance requires --search');
    expect(result.exitCode).toBe(1);
  });

  it('show handles legacy index entries with absent relationship fields', async () => {
    const { rootDir, tasksDir } = setupTasksDir();
    writeFileSync(
      join(tasksDir, 'index.toon'),
      encode({
        version: 1,
        lastUpdatedAt: Date.now(),
        tasks: {
          'AGENT-1': {
            key: 'AGENT-1',
            project: 'AGENT',
            title: 'Primary task',
            status: 'NOT STARTED',
            kind: 'TASK',
            priority: 'HIGH',
            assignee: 'UNASSIGNED',
            reporter: 'USER',
            createdAt: '',
            updatedAt: '',
            lastIndexedAt: Date.now(),
          },
          'AGENT-2': {
            key: 'AGENT-2',
            project: 'AGENT',
            title: 'Archive target',
            status: 'NOT STARTED',
            kind: 'TASK',
            priority: 'MEDIUM',
            assignee: 'UNASSIGNED',
            reporter: 'USER',
            createdAt: '',
            updatedAt: '',
            lastIndexedAt: Date.now(),
          },
        },
        counters: {
          AGENT: { projectKey: 'AGENT', nextTaskNumber: 3 },
        },
      }),
    );

    const result = await runTaskCommand(rootDir, ['show', 'AGENT-1']);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('AGENT-1: Primary task');
  });

  it('update requires a task key or explicit filter', async () => {
    const { rootDir } = setupTasksDir();
    const result = await runTaskCommand(rootDir, ['update', '--status', 'IN_PROGRESS']);

    expect(result.stderr).toContain('Task update requires a task key or at least one explicit filter');
    expect(result.exitCode).toBe(1);
  });

  it('update allows explicit bulk filters', async () => {
    const { rootDir } = setupTasksDir();
    const result = await runTaskCommand(rootDir, ['update', '--status', 'IN_PROGRESS', '-p', 'AGENT']);
    expect(result.stdout).toContain('Updated 2 tasks.');
  });

  it('update', async () => {
    const { rootDir } = setupTasksDir();
    const result = await runTaskCommand(rootDir, ['update', 'AGENT-1', '--status', 'IN_PROGRESS']);
    expect(result.stdout).toContain('Updated 1 task.');
  });

  it('pickup', async () => {
    const { rootDir } = setupTasksDir();
    const result = await runTaskCommand(rootDir, ['pickup', 'AGENT-1']);
    expect(result.stdout).toContain('Picked up 1 task.');
  });

  it('pickup search supports regex backend', async () => {
    const { rootDir } = setupTasksDir();
    const result = await runTaskCommand(rootDir, ['pickup', '-q', 'Primar(?:y)', '--regex']);
    expect(result.stdout).toContain('Picked up 1 task.');
  });

  it('complete', async () => {
    const { rootDir, tasksDir } = setupTasksDir();
    updateTaskFields(join(tasksDir, 'AGENT', 'AGENT-1.md'), {
      status: 'NEEDS REVIEW',
    });

    const result = await runTaskCommand(rootDir, ['complete', 'AGENT-1', '--final', '--resolution', 'DONE']);
    expect(result.stdout).toContain('Completed 1 task → COMPLETE.');
  });

  it('rejects final DONE completion before NEEDS REVIEW', async () => {
    const { rootDir } = setupTasksDir();
    const result = await runTaskCommand(rootDir, ['complete', 'AGENT-1', '--final', '--resolution', 'DONE']);

    expect(result.stderr).toContain('NEEDS REVIEW');
    expect(result.exitCode).toBe(1);
  });

  it('move', async () => {
    const { rootDir } = setupTasksDir();
    const result = await runTaskCommand(rootDir, ['move', 'AGENT-1', '-p', 'TOOLS']);
    expect(result.stdout).toContain('Moved AGENT-1 → TOOLS-1');
  });

  it('archive', async () => {
    const { rootDir, tasksDir } = setupTasksDir();
    updateTaskFields(join(tasksDir, 'AGENT', 'AGENT-2.md'), {
      status: 'COMPLETE',
      resolution: 'DONE',
    });

    const result = await runTaskCommand(rootDir, ['archive']);
    expect(result.stdout).toContain('Archived 1 task:');
    expect(result.stdout).toContain('AGENT-2');
  });
});
