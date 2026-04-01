import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addPathToGitignore, initExternalRepo, initSeparateBranch } from './storage-backend.js';

describe('addPathToGitignore', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'gitignore-update-test-'));
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('creates .gitignore with the entry when no .gitignore exists', () => {
    addPathToGitignore(rootDir, '.sandpiper/tasks/');

    const content = readFileSync(join(rootDir, '.gitignore'), 'utf-8');
    expect(content.split('\n').map((l) => l.trim())).toContain('.sandpiper/tasks/');
  });

  it('appends entry to existing .gitignore that lacks it', () => {
    execSync(`echo '*.log' > ${join(rootDir, '.gitignore')}`);
    addPathToGitignore(rootDir, '.sandpiper/tasks/');

    const content = readFileSync(join(rootDir, '.gitignore'), 'utf-8');
    expect(content).toContain('*.log');
    expect(content.split('\n').map((l) => l.trim())).toContain('.sandpiper/tasks/');
  });

  it('is idempotent when entry already present', () => {
    addPathToGitignore(rootDir, '.sandpiper/tasks/');
    addPathToGitignore(rootDir, '.sandpiper/tasks/');

    const lines = readFileSync(join(rootDir, '.gitignore'), 'utf-8')
      .split('\n')
      .filter((l) => l.trim() === '.sandpiper/tasks/');
    expect(lines).toHaveLength(1);
  });
});

describe('initSeparateBranch — error cases', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'init-branch-test-'));
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('throws when backend is "none" (no VCS repo)', () => {
    expect(() =>
      initSeparateBranch({
        rootDir,
        backend: 'none',
        branchName: 'sandpiper-tasks',
        workspacePath: join(rootDir, '.sandpiper', 'tasks'),
      }),
    ).toThrow('no VCS repository detected');
  });

  it('is idempotent when workspace path already exists', () => {
    const workspacePath = join(rootDir, '.sandpiper', 'tasks');
    mkdirSync(workspacePath, { recursive: true });

    // Should not throw even though the path exists
    expect(() =>
      initSeparateBranch({
        rootDir,
        backend: 'git',
        branchName: 'sandpiper-tasks',
        workspacePath,
      }),
    ).not.toThrow();
  });
});

describe('initSeparateBranch — git backend (integration)', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'init-git-test-'));
    execSync('git init -q', { cwd: rootDir });
    execSync('git config user.email "test@test.com"', { cwd: rootDir });
    execSync('git config user.name "Test"', { cwd: rootDir });
    // Need at least one commit so the worktree has a HEAD to reference
    execSync('git commit --allow-empty -m "init"', { cwd: rootDir });
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('creates a git worktree at the given path on an orphan branch', () => {
    const workspacePath = join(rootDir, '.sandpiper', 'tasks');
    initSeparateBranch({
      rootDir,
      backend: 'git',
      branchName: 'sandpiper-tasks',
      workspacePath,
    });

    expect(existsSync(workspacePath)).toBe(true);
    // Orphan branches don't appear in `git branch` until a commit exists;
    // verify via `git worktree list` instead.
    const worktrees = execSync('git worktree list', { cwd: rootDir, encoding: 'utf-8' });
    expect(worktrees).toContain('sandpiper-tasks');
  });
});

describe('initExternalRepo — git backend (integration)', () => {
  let rootDir: string;
  let remoteDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'ext-repo-git-test-'));
    remoteDir = mkdtempSync(join(tmpdir(), 'ext-repo-remote-'));
    // Current project repo
    execSync('git init -q', { cwd: rootDir });
    execSync('git config user.email "test@test.com"', { cwd: rootDir });
    execSync('git config user.name "Test"', { cwd: rootDir });
    execSync('git commit --allow-empty -m "init"', { cwd: rootDir });
    // Remote repo to clone from (non-bare is fine for local clones)
    execSync('git init -q', { cwd: remoteDir });
    execSync('git config user.email "test@test.com"', { cwd: remoteDir });
    execSync('git config user.name "Test"', { cwd: remoteDir });
    execSync('git commit --allow-empty -m "remote init"', { cwd: remoteDir });
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
    rmSync(remoteDir, { recursive: true, force: true });
  });

  it('clones the external repo into .sandpiper/tasks/', () => {
    const clonePath = join(rootDir, '.sandpiper', 'tasks');
    initExternalRepo({
      rootDir,
      backend: 'git',
      repoUrl: remoteDir,
      clonePath,
      branchName: '@',
    });

    expect(existsSync(clonePath)).toBe(true);
    expect(existsSync(join(clonePath, '.git'))).toBe(true);
  });

  it('is idempotent when clone path already exists', () => {
    const clonePath = join(rootDir, '.sandpiper', 'tasks');
    initExternalRepo({ rootDir, backend: 'git', repoUrl: remoteDir, clonePath, branchName: '@' });
    // Should not throw
    expect(() =>
      initExternalRepo({ rootDir, backend: 'git', repoUrl: remoteDir, clonePath, branchName: '@' }),
    ).not.toThrow();
  });
});

describe('initSeparateBranch — jj backend (integration)', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'init-jj-test-'));
    execSync('jj git init --colocate', { cwd: rootDir, stdio: 'pipe' });
  });

  afterEach(() => {
    // Node's rmSync struggles with jj's .jj workspace symlink structure on macOS
    execSync(`rm -rf "${rootDir}"`);
  });

  it('creates a jj workspace and bookmark at the given path', () => {
    const workspacePath = join(rootDir, '.sandpiper', 'tasks');
    initSeparateBranch({
      rootDir,
      backend: 'jj',
      branchName: 'sandpiper-tasks',
      workspacePath,
    });

    expect(existsSync(workspacePath)).toBe(true);
    const workspaces = execSync('jj workspace list', { cwd: rootDir, encoding: 'utf-8' });
    expect(workspaces).toContain('tasks');
  });
});
