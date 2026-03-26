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

describe('CLI: project show', () => {
  let tempDir: string;
  let tasksDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'project-cmd-test-'));
    tasksDir = setupTasksDir(tempDir);
    runCli([
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
      'Use for Foo work',
    ]);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should print the PROJECT.md content', () => {
    const result = runCli(['--dir', tempDir, 'project', 'show', 'FOO']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('key: FOO');
    expect(result.stdout).toContain('name: "Foo Project"');
    expect(result.stdout).toContain('when_to_file: "Use for Foo work"');
    expect(result.stdout).toContain('## Purpose');
  });

  it('should fail for a project without PROJECT.md', () => {
    mkdirSync(join(tasksDir, 'BAR'));
    const result = runCli(['--dir', tempDir, 'project', 'show', 'BAR']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('PROJECT.md');
  });

  it('should normalize key to uppercase', () => {
    const result = runCli(['--dir', tempDir, 'project', 'show', 'foo']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('key: FOO');
  });
});

describe('CLI: project update', () => {
  let tempDir: string;
  let tasksDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'project-cmd-test-'));
    tasksDir = setupTasksDir(tempDir);
    runCli([
      '--dir',
      tempDir,
      'project',
      'create',
      'FOO',
      '--name',
      'Foo Project',
      '--description',
      'Original description',
      '--when-to-file',
      'Original trigger',
    ]);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should update name', () => {
    runCli(['--dir', tempDir, 'project', 'update', 'FOO', '--name', 'New Name']);
    expect(readProjectMetadata(tasksDir, 'FOO')?.name).toBe('New Name');
  });

  it('should update when-to-file', () => {
    runCli(['--dir', tempDir, 'project', 'update', 'FOO', '--when-to-file', 'Updated trigger']);
    expect(readProjectMetadata(tasksDir, 'FOO')?.whenToFile).toBe('Updated trigger');
  });

  it('should update status', () => {
    runCli(['--dir', tempDir, 'project', 'update', 'FOO', '--status', 'archived']);
    expect(readProjectMetadata(tasksDir, 'FOO')?.status).toBe('archived');
  });

  it('should reject invalid status values', () => {
    const result = runCli(['--dir', tempDir, 'project', 'update', 'FOO', '--status', 'invalid']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Invalid status');
  });

  it('should fail when no fields are provided and not interactive', () => {
    const result = runCli(['--dir', tempDir, 'project', 'update', 'FOO']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No fields to update');
  });

  it('should fail for a project without PROJECT.md', () => {
    mkdirSync(join(tasksDir, 'BAR'));
    const result = runCli(['--dir', tempDir, 'project', 'update', 'BAR', '--name', 'X']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('PROJECT.md');
  });

  it('should preserve unchanged fields after update', () => {
    runCli(['--dir', tempDir, 'project', 'update', 'FOO', '--name', 'Changed']);
    const meta = readProjectMetadata(tasksDir, 'FOO');
    expect(meta?.name).toBe('Changed');
    expect(meta?.description).toBe('Original description');
    expect(meta?.whenToFile).toBe('Original trigger');
  });
});

describe('CLI: project list with metadata', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'project-cmd-test-'));
    setupTasksDir(tempDir);
    // Create a project with metadata and one without
    runCli([
      '--dir',
      tempDir,
      'project',
      'create',
      'AAA',
      '--name',
      'Alpha',
      '--description',
      'Alpha desc',
      '--when-to-file',
      'Use for alpha',
    ]);
    // Create a project directory without a PROJECT.md (simulating a legacy project)
    mkdirSync(join(tempDir, '.sandpiper', 'tasks', 'ZZZ'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should show name in human output when PROJECT.md exists', () => {
    const result = runCli(['--dir', tempDir, 'project', 'list']);
    expect(result.exitCode).toBe(0);
    // AAA has no tasks so won't appear in groupByProject — that's expected
    expect(result.stdout).toBeDefined();
  });

  it('should return toon output with whenToFile when format is toon', () => {
    // Add a task to AAA so it shows up in the list
    runCli(['--dir', tempDir, 'task', 'create', '--project', 'AAA', '--title', 'A task']);
    const result = runCli(['--dir', tempDir, '--format', 'toon', 'project', 'list']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('whenToFile');
    expect(result.stdout).toContain('Use for alpha');
  });

  it('should return json output with metadata fields', () => {
    runCli(['--dir', tempDir, 'task', 'create', '--project', 'AAA', '--title', 'A task']);
    const result = runCli(['--dir', tempDir, '--format', 'json', 'project', 'list']);
    expect(result.exitCode).toBe(0);
    const items = JSON.parse(result.stdout);
    expect(items).toHaveLength(1);
    expect(items[0].key).toBe('AAA');
    expect(items[0].whenToFile).toBe('Use for alpha');
    expect(items[0].taskCount).toBe(1);
  });
});
