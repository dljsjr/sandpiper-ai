import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { autoCommitIfEnabled } from './auto-commit.js';
import type { TaskStorageConfig } from './storage-config.js';

const SEPARATE_BRANCH_CONFIG: TaskStorageConfig = {
  version_control: {
    enabled: true,
    mode: { branch: 'sandpiper-tasks' },
    auto_commit: true,
    auto_push: false,
  },
};

describe('autoCommitIfEnabled', () => {
  let rootDir: string;
  let workspacePath: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'auto-commit-test-'));
    workspacePath = join(rootDir, '.sandpiper', 'tasks');
    // Set up a plain git worktree for the task branch
    execSync('git init -q', { cwd: rootDir });
    execSync('git config user.email "test@test.com"', { cwd: rootDir });
    execSync('git config user.name "Test"', { cwd: rootDir });
    execSync('git commit --allow-empty -m "init"', { cwd: rootDir });
    execSync(`git worktree add --orphan -b sandpiper-tasks "${workspacePath}"`, { cwd: rootDir });
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('does nothing when auto_commit is false', () => {
    const config: TaskStorageConfig = {
      ...SEPARATE_BRANCH_CONFIG,
      version_control: { ...SEPARATE_BRANCH_CONFIG.version_control, auto_commit: false },
    };
    writeFileSync(join(workspacePath, 'dummy.md'), 'hello');

    autoCommitIfEnabled(rootDir, config, 'Create TST-1: test task');

    // No commit should have been made (branch is still unborn)
    const result = execSync('git worktree list', { cwd: rootDir, encoding: 'utf-8' });
    expect(result).toContain('sandpiper-tasks');
    // Unborn branch = no commits; git log would fail
    expect(() => execSync('git log sandpiper-tasks', { cwd: rootDir, stdio: 'pipe' })).toThrow();
  });

  it('commits pending changes when auto_commit is true', () => {
    writeFileSync(join(workspacePath, 'TST-1.md'), '# Test task\n');

    autoCommitIfEnabled(rootDir, SEPARATE_BRANCH_CONFIG, 'Create TST-1: test task');

    const log = execSync('git log --oneline sandpiper-tasks', { cwd: rootDir, encoding: 'utf-8' });
    expect(log).toContain('Create TST-1: test task');
  });
});
