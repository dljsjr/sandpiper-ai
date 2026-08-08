/**
 * Unit tests for autoCommitIfEnabled's dispatch logic, against the injected
 * VcsRunner seam (see storage-backend.ts) — no real git/jj spawned.
 *
 * `detectVcsBackend` only needs a `.git` or `.jj` directory marker on disk,
 * not a real repository, so these tests fake that with a plain `mkdirSync`.
 *
 * The TCL-143 auto_push-with-no-upstream regression test intentionally
 * stays real (see auto-commit.integration.test.ts) — it depends on git's
 * actual "no upstream branch" error text and retry semantics, which a
 * command-fake would just be asserting back at itself.
 */
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { autoCommitIfEnabled } from './auto-commit.js';
import { resetVcsRunner, setVcsRunner, type VcsCommandResult } from './storage-backend.js';
import type { TaskStorageConfig } from './storage-config.js';

const SEPARATE_BRANCH_CONFIG: TaskStorageConfig = {
  version_control: {
    enabled: true,
    mode: { branch: 'sandpiper-tasks' },
    auto_commit: true,
    auto_push: false,
  },
};

interface RecordedCall {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
}

function createFakeRunner(script: readonly (VcsCommandResult | Error)[] = []) {
  const calls: RecordedCall[] = [];
  setVcsRunner((command, args, cwd) => {
    const index = calls.length;
    calls.push({ command, args: [...args], cwd });
    const scripted = script[index];
    if (scripted instanceof Error) throw scripted;
    return scripted ?? { stdout: '' };
  });
  return calls;
}

describe('autoCommitIfEnabled', () => {
  let rootDir: string;
  let workspacePath: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'auto-commit-unit-'));
    workspacePath = join(rootDir, '.sandpiper', 'tasks');
    mkdirSync(join(rootDir, '.git'));
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
    resetVcsRunner();
  });

  it('does nothing when auto_commit is false (no VCS command issued)', () => {
    const calls = createFakeRunner();
    const config: TaskStorageConfig = {
      ...SEPARATE_BRANCH_CONFIG,
      version_control: { ...SEPARATE_BRANCH_CONFIG.version_control, auto_commit: false },
    };

    autoCommitIfEnabled(rootDir, config, 'Create TST-1: test task');

    expect(calls).toEqual([]);
  });

  it('does nothing in inline mode (branch "@", no repo) even if auto_commit is true', () => {
    const calls = createFakeRunner();
    const config: TaskStorageConfig = {
      version_control: { enabled: true, mode: { branch: '@' }, auto_commit: true, auto_push: false },
    };

    autoCommitIfEnabled(rootDir, config, 'Create TST-1: test task');

    expect(calls).toEqual([]);
  });

  it('commits pending changes when auto_commit is true (git add -A, then git commit -m)', () => {
    const calls = createFakeRunner();

    autoCommitIfEnabled(rootDir, SEPARATE_BRANCH_CONFIG, 'Create TST-1: test task');

    expect(calls).toEqual([
      { command: 'git', args: ['add', '-A'], cwd: workspacePath },
      { command: 'git', args: ['commit', '-m', 'Create TST-1: test task'], cwd: workspacePath },
    ]);
  });

  it('does not push when auto_push is false', () => {
    const calls = createFakeRunner();

    autoCommitIfEnabled(rootDir, SEPARATE_BRANCH_CONFIG, 'Create TST-1: test task');

    expect(calls.some((c) => c.args.includes('push'))).toBe(false);
  });

  it('pushes after committing when auto_push is true', () => {
    const calls = createFakeRunner();
    const config: TaskStorageConfig = {
      ...SEPARATE_BRANCH_CONFIG,
      version_control: { ...SEPARATE_BRANCH_CONFIG.version_control, auto_push: true },
    };

    autoCommitIfEnabled(rootDir, config, 'Create TST-2: auto push test');

    expect(calls).toEqual([
      { command: 'git', args: ['add', '-A'], cwd: workspacePath },
      { command: 'git', args: ['commit', '-m', 'Create TST-2: auto push test'], cwd: workspacePath },
      { command: 'git', args: ['push'], cwd: workspacePath },
    ]);
  });

  it('jj backend: commits via `jj commit -m`, no `git add` step', () => {
    rmSync(join(rootDir, '.git'), { recursive: true, force: true });
    mkdirSync(join(rootDir, '.jj'));
    const calls = createFakeRunner();

    autoCommitIfEnabled(rootDir, SEPARATE_BRANCH_CONFIG, 'Create TST-1: test task');

    expect(calls).toEqual([{ command: 'jj', args: ['commit', '-m', 'Create TST-1: test task'], cwd: workspacePath }]);
  });
});
