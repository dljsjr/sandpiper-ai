/**
 * Real-git integration test for autoCommitIfEnabled's auto_push path.
 *
 * This one test stays real deliberately (per TCL-144's direction): the
 * TCL-143 bug it guards — a bare `git push` failing with "no upstream
 * branch" on the very first auto_push after a fresh worktree/checkout —
 * is a fact about real git's error text and exit behavior. A fake VcsRunner
 * would just replay whatever error text the test itself scripted, so it
 * can't catch a regression where trail's retry stops matching what git
 * actually says. See auto-commit.test.ts for the exhaustive (fake-runner)
 * dispatch-logic coverage of autoCommitIfEnabled.
 */
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
    auto_push: true,
  },
};

describe('autoCommitIfEnabled — auto_push, real git integration', () => {
  let rootDir: string;
  let workspacePath: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'auto-commit-integration-'));
    workspacePath = join(rootDir, '.sandpiper', 'tasks');
    execSync('git init -q', { cwd: rootDir });
    execSync('git config user.email "test@test.com"', { cwd: rootDir });
    execSync('git config user.name "Test"', { cwd: rootDir });
    execSync('git commit --allow-empty -m "init"', { cwd: rootDir });
    execSync(`git worktree add --orphan -b sandpiper-tasks "${workspacePath}"`, { cwd: rootDir });
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('establishes upstream tracking and pushes on the first auto_push after a fresh worktree (TCL-143)', () => {
    // Arrange: bare remote, no prior push/upstream — the exact state right
    // after separate-branch storage init (initGitWorktree's `git worktree add
    // --orphan`), before any manual `git push -u` has ever been run.
    const remoteDir = mkdtempSync(join(tmpdir(), 'auto-push-fresh-remote-'));
    try {
      execSync('git init --bare -q', { cwd: remoteDir });
      execSync(`git remote add origin "${remoteDir}"`, { cwd: workspacePath });

      writeFileSync(join(workspacePath, 'TST-1.md'), '# Task\n');

      // Act — no upstream configured yet; pushTaskBranch must establish it and
      // retry rather than failing with "no upstream branch".
      autoCommitIfEnabled(rootDir, SEPARATE_BRANCH_CONFIG, 'Create TST-1: first auto push');

      // Assert: remote has the commit, and the local branch now tracks origin.
      const remoteLog = execSync('git log --oneline sandpiper-tasks', {
        cwd: remoteDir,
        encoding: 'utf-8',
      });
      expect(remoteLog).toContain('Create TST-1: first auto push');

      const upstream = execSync('git rev-parse --abbrev-ref sandpiper-tasks@{upstream}', {
        cwd: workspacePath,
        encoding: 'utf-8',
      }).trim();
      expect(upstream).toBe('origin/sandpiper-tasks');
    } finally {
      rmSync(remoteDir, { recursive: true, force: true });
    }
  });
});
