import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readProjectMetadata } from '../core/project-metadata.js';

const CLI_PATH = join(import.meta.dirname!, '..', 'index.ts');

function runCli(args: string[], cwd?: string): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync('bun', [CLI_PATH, ...args], {
    encoding: 'utf-8',
    cwd: cwd ?? process.cwd(),
    timeout: 10_000,
    env: { ...process.env },
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

function setupTasksDir(baseDir: string): string {
  const tasksDir = join(baseDir, '.sandpiper', 'tasks');
  mkdirSync(tasksDir, { recursive: true });
  return tasksDir;
}

describe('CLI: project create', () => {
  let tempDir: string;
  let tasksDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'project-cmd-test-'));
    tasksDir = setupTasksDir(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should create a project directory and PROJECT.md', () => {
    const result = runCli([
      '--dir',
      tempDir,
      'project',
      'create',
      'FOO',
      '--name',
      'Foo Project',
      '--description',
      'A test project',
      '--when-to-file',
      'Use for all Foo work',
    ]);
    expect(result.exitCode).toBe(0);
    expect(existsSync(join(tasksDir, 'FOO'))).toBe(true);
    expect(existsSync(join(tasksDir, 'FOO', 'PROJECT.md'))).toBe(true);
  });

  it('should write correct metadata to PROJECT.md', () => {
    runCli([
      '--dir',
      tempDir,
      'project',
      'create',
      'BAR',
      '--name',
      'Bar Project',
      '--description',
      'Bar description',
      '--when-to-file',
      'Use for bar tasks',
    ]);
    const meta = readProjectMetadata(tasksDir, 'BAR');
    expect(meta?.key).toBe('BAR');
    expect(meta?.name).toBe('Bar Project');
    expect(meta?.description).toBe('Bar description');
    expect(meta?.whenToFile).toBe('Use for bar tasks');
    expect(meta?.status).toBe('active');
  });

  it('should normalize the project key to uppercase', () => {
    const result = runCli([
      '--dir',
      tempDir,
      'project',
      'create',
      'foo',
      '--name',
      'Foo',
      '--description',
      'desc',
      '--when-to-file',
      'when',
    ]);
    expect(result.exitCode).toBe(0);
    expect(existsSync(join(tasksDir, 'FOO'))).toBe(true);
  });

  it('should print confirmation output', () => {
    const result = runCli([
      '--dir',
      tempDir,
      'project',
      'create',
      'FOO',
      '--name',
      'My Project',
      '--description',
      'desc',
      '--when-to-file',
      'Use for this',
    ]);
    expect(result.stdout).toContain('Created project: FOO');
    expect(result.stdout).toContain('My Project');
    expect(result.stdout).toContain('Use for this');
  });

  it('should fail if --name is missing', () => {
    const result = runCli([
      '--dir',
      tempDir,
      'project',
      'create',
      'FOO',
      '--description',
      'desc',
      '--when-to-file',
      'when',
    ]);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('--name');
  });

  it('should fail if --description is missing', () => {
    const result = runCli(['--dir', tempDir, 'project', 'create', 'FOO', '--name', 'Name', '--when-to-file', 'when']);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('--description');
  });

  it('should fail if --when-to-file is missing', () => {
    const result = runCli(['--dir', tempDir, 'project', 'create', 'FOO', '--name', 'Name', '--description', 'desc']);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('--when-to-file');
  });

  it('should fail if the project already exists', () => {
    const baseArgs = [
      '--dir',
      tempDir,
      'project',
      'create',
      'FOO',
      '--name',
      'Foo',
      '--description',
      'desc',
      '--when-to-file',
      'when',
    ];
    runCli(baseArgs);
    const result = runCli(baseArgs);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('already exists');
  });
});
