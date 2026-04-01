/**
 * Integration tests for the `storage` command group.
 * These tests run the actual CLI binary against real temp repos.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const CLI_PATH = join(import.meta.dirname!, '..', 'index.ts');

function runCli(args: string, cwd?: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`bun ${CLI_PATH} ${args}`, {
      encoding: 'utf-8',
      cwd,
      timeout: 15_000,
      env: { ...process.env },
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error: unknown) {
    const e = error as { stdout?: string; stderr?: string; status?: number };
    return { stdout: e.stdout ?? '', stderr: e.stderr ?? '', exitCode: e.status ?? 1 };
  }
}

// ─── storage init — mode: inline (default) ───────────────────────

describe('storage init — inline mode (default)', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'storage-init-inline-test-'));
    mkdirSync(join(rootDir, '.sandpiper', 'tasks'), { recursive: true });
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('reports that inline mode requires no special initialisation', () => {
    const result = runCli(`--dir ${rootDir} storage init`);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/inline|already|no.?init/i);
  });
});

// ─── storage init — no VCS, separate-branch config ───────────────

describe('storage init — no VCS repo, separate-branch config', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'storage-init-novcs-test-'));
    mkdirSync(join(rootDir, '.sandpiper', 'tasks'), { recursive: true });
    writeFileSync(
      join(rootDir, '.sandpiper-tasks.json'),
      JSON.stringify({ version_control: { mode: { branch: 'sandpiper-tasks' } } }),
    );
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('exits with error when no VCS repo is detected', () => {
    const result = runCli(`--dir ${rootDir} storage init`);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/no VCS|no vcs|repository/i);
  });
});

// ─── storage init — git backend ──────────────────────────────────

describe('storage init — git backend (integration)', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'storage-init-git-test-'));
    execSync('git init -q', { cwd: rootDir });
    execSync('git config user.email "test@test.com"', { cwd: rootDir });
    execSync('git config user.name "Test"', { cwd: rootDir });
    execSync('git commit --allow-empty -m "init"', { cwd: rootDir });
    // Do NOT pre-create .sandpiper/tasks — storage init must create it via worktree
    writeFileSync(
      join(rootDir, '.sandpiper-tasks.json'),
      JSON.stringify({ version_control: { mode: { branch: 'sandpiper-tasks' } } }),
    );
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('creates a git worktree at .sandpiper/tasks/', () => {
    const result = runCli(`--dir ${rootDir} storage init`);
    expect(result.exitCode).toBe(0);
    expect(existsSync(join(rootDir, '.sandpiper', 'tasks'))).toBe(true);
    const worktrees = execSync('git worktree list', { cwd: rootDir, encoding: 'utf-8' });
    expect(worktrees).toContain('sandpiper-tasks');
  });

  it('adds .sandpiper/tasks/ to .gitignore on the main branch', () => {
    runCli(`--dir ${rootDir} storage init`);
    const gitignore = readFileSync(join(rootDir, '.gitignore'), 'utf-8');
    expect(gitignore.split('\n').map((l) => l.trim())).toContain('.sandpiper/tasks/');
  });

  it('is idempotent when run a second time', () => {
    runCli(`--dir ${rootDir} storage init`);
    const result = runCli(`--dir ${rootDir} storage init`);
    expect(result.exitCode).toBe(0);
  });
});

// ─── storage init — jj backend ───────────────────────────────────

describe('storage init — jj backend (integration)', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'storage-init-jj-test-'));
    execSync('jj git init --colocate', { cwd: rootDir, stdio: 'pipe' });
    // Do NOT pre-create .sandpiper/tasks — storage init must create it via jj workspace
    writeFileSync(
      join(rootDir, '.sandpiper-tasks.json'),
      JSON.stringify({ version_control: { mode: { branch: 'sandpiper-tasks' } } }),
    );
  });

  afterEach(() => {
    execSync(`rm -rf "${rootDir}"`);
  });

  it('creates a jj workspace at .sandpiper/tasks/', () => {
    const result = runCli(`--dir ${rootDir} storage init`);
    expect(result.exitCode).toBe(0);
    const workspaces = execSync('jj workspace list', { cwd: rootDir, encoding: 'utf-8' });
    expect(workspaces).toContain('tasks');
  });

  it('adds .sandpiper/tasks/ to .gitignore on the main branch', () => {
    runCli(`--dir ${rootDir} storage init`);
    const gitignore = readFileSync(join(rootDir, '.gitignore'), 'utf-8');
    expect(gitignore.split('\n').map((l) => l.trim())).toContain('.sandpiper/tasks/');
  });
});
