import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from '@commander-js/extra-typings';
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

async function runTaskCommand(rootDir: string, args: readonly string[]): Promise<{ stdout: string; stderr: string }> {
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
      .name('sandpiper-tasks')
      .option('-d, --dir <path>')
      .option('-f, --format <format>')
      .option('--no-save')
      .addCommand(taskCommand);

    await program.parseAsync(['-d', rootDir, 'task', ...args], { from: 'user' });
  } finally {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  }

  return { stdout: logs.join('\n'), stderr: errors.join('\n') };
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

  it('complete', async () => {
    const { rootDir } = setupTasksDir();
    const result = await runTaskCommand(rootDir, ['complete', 'AGENT-1', '--final', '--resolution', 'DONE']);
    expect(result.stdout).toContain('Completed 1 task → COMPLETE.');
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
