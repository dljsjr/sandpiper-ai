/**
 * Unit tests for storage-backend.ts's VCS-issuing logic.
 *
 * These assert on the exact command sequences trail issues (and how it
 * reacts to scripted outputs/failures) via the injected `VcsRunner` seam
 * (`setVcsRunner`/`resetVcsRunner`), without spawning real git or jj
 * processes. A deliberately thin set of true git/jj integration tests
 * lives in `storage-backend.integration.test.ts` — the reality-check
 * layer for behavior a command-fake can't see (real argv-array vs. shell
 * semantics, real jj immutable-commit rules, etc.).
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  commitTaskChanges,
  initExternalRepo,
  initSeparateBranch,
  pullTaskBranch,
  pushTaskBranch,
  resetVcsRunner,
  setVcsRunner,
  type VcsCommandResult,
} from './storage-backend.js';

// ─── Fake VCS runner ─────────────────────────────────────────────

interface RecordedCall {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
}

/**
 * A fake runner that records every call and, per call, either returns a
 * scripted result or throws a scripted error. `script` is consulted by
 * call index (0-based); calls beyond the script length succeed with empty
 * stdout.
 */
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

afterEach(() => {
  resetVcsRunner();
});

// ─── initSeparateBranch — error cases (no VCS involved) ──────────

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

  it('is idempotent when workspace path already exists (no VCS command issued)', () => {
    const workspacePath = join(rootDir, '.sandpiper', 'tasks');
    mkdirSync(workspacePath, { recursive: true });
    const calls = createFakeRunner();

    expect(() =>
      initSeparateBranch({
        rootDir,
        backend: 'git',
        branchName: 'sandpiper-tasks',
        workspacePath,
      }),
    ).not.toThrow();
    expect(calls).toEqual([]);
  });
});

// ─── initSeparateBranch — command sequences ───────────────────────

describe('initSeparateBranch', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'init-branch-unit-'));
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('git backend: issues a single `git worktree add --orphan -b <branch> <path>`', () => {
    const calls = createFakeRunner();
    const workspacePath = join(rootDir, '.sandpiper', 'tasks');

    initSeparateBranch({ rootDir, backend: 'git', branchName: 'sandpiper-tasks', workspacePath });

    expect(calls).toEqual([
      { command: 'git', args: ['worktree', 'add', '--orphan', '-b', 'sandpiper-tasks', workspacePath], cwd: rootDir },
    ]);
  });

  it('jj backend: issues `jj workspace add` then `jj bookmark create -r @` (not @-, to avoid root())', () => {
    const calls = createFakeRunner();
    const workspacePath = join(rootDir, '.sandpiper', 'tasks');

    initSeparateBranch({ rootDir, backend: 'jj', branchName: 'sandpiper-tasks', workspacePath });

    expect(calls).toEqual([
      {
        command: 'jj',
        args: ['workspace', 'add', workspacePath, '--name', 'tasks', '--revision', 'root()'],
        cwd: rootDir,
      },
      { command: 'jj', args: ['bookmark', 'create', 'sandpiper-tasks', '-r', '@'], cwd: workspacePath },
    ]);
  });

  it('jj backend: creates the workspace directory before issuing `jj workspace add` (jj does not create parents)', () => {
    createFakeRunner();
    const workspacePath = join(rootDir, '.sandpiper', 'tasks');

    initSeparateBranch({ rootDir, backend: 'jj', branchName: 'sandpiper-tasks', workspacePath });

    expect(existsSync(workspacePath)).toBe(true);
  });
});

// ─── initExternalRepo — command sequences ─────────────────────────

describe('initExternalRepo', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'ext-repo-unit-'));
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('is idempotent when clone path already exists (no VCS command issued)', () => {
    const clonePath = join(rootDir, '.sandpiper', 'tasks');
    mkdirSync(clonePath, { recursive: true });
    const calls = createFakeRunner();

    expect(() =>
      initExternalRepo({
        rootDir,
        backend: 'git',
        repoUrl: 'https://example.invalid/x.git',
        clonePath,
        branchName: '@',
      }),
    ).not.toThrow();
    expect(calls).toEqual([]);
  });

  it('git backend, branchName "@": issues only `git clone`, no checkout', () => {
    const calls = createFakeRunner();
    const clonePath = join(rootDir, '.sandpiper', 'tasks');

    initExternalRepo({ rootDir, backend: 'git', repoUrl: 'https://example.invalid/x.git', clonePath, branchName: '@' });

    expect(calls).toEqual([
      { command: 'git', args: ['clone', 'https://example.invalid/x.git', clonePath], cwd: rootDir },
    ]);
  });

  it('git backend, named branch that exists on the remote: clone then `git checkout <branch>` succeeds, no fallback', () => {
    const calls = createFakeRunner([{ stdout: '' }, { stdout: '' }]);
    const clonePath = join(rootDir, '.sandpiper', 'tasks');

    initExternalRepo({
      rootDir,
      backend: 'git',
      repoUrl: 'https://example.invalid/x.git',
      clonePath,
      branchName: 'sandpiper-tasks',
    });

    expect(calls).toEqual([
      { command: 'git', args: ['clone', 'https://example.invalid/x.git', clonePath], cwd: rootDir },
      { command: 'git', args: ['checkout', 'sandpiper-tasks'], cwd: clonePath },
    ]);
  });

  it('git backend, named branch absent on the remote: `git checkout <branch>` fails, falls back to `git checkout -b <branch>`', () => {
    const calls = createFakeRunner([{ stdout: '' }, new Error('pathspec did not match'), { stdout: '' }]);
    const clonePath = join(rootDir, '.sandpiper', 'tasks');

    initExternalRepo({
      rootDir,
      backend: 'git',
      repoUrl: 'https://example.invalid/x.git',
      clonePath,
      branchName: 'sandpiper-tasks',
    });

    expect(calls).toEqual([
      { command: 'git', args: ['clone', 'https://example.invalid/x.git', clonePath], cwd: rootDir },
      { command: 'git', args: ['checkout', 'sandpiper-tasks'], cwd: clonePath },
      { command: 'git', args: ['checkout', '-b', 'sandpiper-tasks'], cwd: clonePath },
    ]);
  });

  it('jj backend, branchName "@": issues only `jj git clone --colocate`, no bookmark commands', () => {
    const calls = createFakeRunner();
    const clonePath = join(rootDir, '.sandpiper', 'tasks');

    initExternalRepo({ rootDir, backend: 'jj', repoUrl: 'https://example.invalid/x.git', clonePath, branchName: '@' });

    expect(calls).toEqual([
      { command: 'jj', args: ['git', 'clone', '--colocate', 'https://example.invalid/x.git', clonePath], cwd: rootDir },
    ]);
  });

  it('jj backend, named branch that exists on the remote: sets the bookmark to the remote ref, then `jj new` onto a mutable commit', () => {
    const calls = createFakeRunner([{ stdout: '' }, { stdout: '' }, { stdout: '' }]);
    const clonePath = join(rootDir, '.sandpiper', 'tasks');

    initExternalRepo({
      rootDir,
      backend: 'jj',
      repoUrl: 'https://example.invalid/x.git',
      clonePath,
      branchName: 'sandpiper-tasks',
    });

    expect(calls).toEqual([
      { command: 'jj', args: ['git', 'clone', '--colocate', 'https://example.invalid/x.git', clonePath], cwd: rootDir },
      { command: 'jj', args: ['bookmark', 'set', 'sandpiper-tasks', '-r', 'sandpiper-tasks@origin'], cwd: clonePath },
      { command: 'jj', args: ['new', 'sandpiper-tasks'], cwd: clonePath },
    ]);
  });

  it('jj backend, named branch absent on the remote: `jj bookmark set` fails, falls back to `jj bookmark create -r @`', () => {
    const calls = createFakeRunner([{ stdout: '' }, new Error('no such remote bookmark')]);
    const clonePath = join(rootDir, '.sandpiper', 'tasks');

    initExternalRepo({
      rootDir,
      backend: 'jj',
      repoUrl: 'https://example.invalid/x.git',
      clonePath,
      branchName: 'sandpiper-tasks',
    });

    expect(calls).toEqual([
      { command: 'jj', args: ['git', 'clone', '--colocate', 'https://example.invalid/x.git', clonePath], cwd: rootDir },
      { command: 'jj', args: ['bookmark', 'set', 'sandpiper-tasks', '-r', 'sandpiper-tasks@origin'], cwd: clonePath },
      { command: 'jj', args: ['bookmark', 'create', 'sandpiper-tasks', '-r', '@'], cwd: clonePath },
    ]);
  });
});

// ─── commitTaskChanges — command sequences ────────────────────────

describe('commitTaskChanges', () => {
  const workspacePath = '/fake/workspace';

  it('jj backend: issues `jj commit -m <message>`', () => {
    const calls = createFakeRunner();

    commitTaskChanges(workspacePath, 'jj', 'Create TST-1: test task');

    expect(calls).toEqual([{ command: 'jj', args: ['commit', '-m', 'Create TST-1: test task'], cwd: workspacePath }]);
  });

  it('git backend: issues `git add -A` then `git commit -m <message>`', () => {
    const calls = createFakeRunner();

    commitTaskChanges(workspacePath, 'git', 'Create TST-1: test task');

    expect(calls).toEqual([
      { command: 'git', args: ['add', '-A'], cwd: workspacePath },
      { command: 'git', args: ['commit', '-m', 'Create TST-1: test task'], cwd: workspacePath },
    ]);
  });

  it('passes a message containing shell metacharacters as a single literal argv element, not concatenated into a string', () => {
    const calls = createFakeRunner();
    const message = 'Create TCL-1: quote " semicolon ; touch /tmp/injected';

    commitTaskChanges(workspacePath, 'git', message);

    expect(calls[1]?.args).toEqual(['commit', '-m', message]);
  });
});

// ─── pushTaskBranch — command sequences, including the upstream fallback ──

describe('pushTaskBranch', () => {
  const workspacePath = '/fake/workspace';

  it('jj backend: issues `jj git push --bookmark <branch>`', () => {
    const calls = createFakeRunner();

    pushTaskBranch(workspacePath, 'jj', 'sandpiper-tasks');

    expect(calls).toEqual([
      { command: 'jj', args: ['git', 'push', '--bookmark', 'sandpiper-tasks'], cwd: workspacePath },
    ]);
  });

  it('git backend: `git push` succeeds, no fallback issued', () => {
    const calls = createFakeRunner();

    pushTaskBranch(workspacePath, 'git', 'sandpiper-tasks');

    expect(calls).toEqual([{ command: 'git', args: ['push'], cwd: workspacePath }]);
  });

  it('git backend (TCL-143 shape): `git push` fails with "no upstream branch" — retries with --set-upstream against the actual current branch', () => {
    const noUpstreamError = Object.assign(new Error('failed'), {
      stderr: 'fatal: The current branch sandpiper-tasks has no upstream branch.\n',
    });
    const calls = createFakeRunner([noUpstreamError, { stdout: 'sandpiper-tasks\n' }, { stdout: '' }]);

    pushTaskBranch(workspacePath, 'git', '@');

    expect(calls).toEqual([
      { command: 'git', args: ['push'], cwd: workspacePath },
      { command: 'git', args: ['branch', '--show-current'], cwd: workspacePath },
      { command: 'git', args: ['push', '--set-upstream', 'origin', 'sandpiper-tasks'], cwd: workspacePath },
    ]);
  });

  it('git backend: a push failure unrelated to upstream tracking propagates without retry', () => {
    const rejectedError = Object.assign(new Error('failed'), {
      stderr: 'error: failed to push some refs (rejected: non-fast-forward)\n',
    });
    const calls = createFakeRunner([rejectedError]);

    expect(() => pushTaskBranch(workspacePath, 'git', 'sandpiper-tasks')).toThrow('failed');
    expect(calls).toEqual([{ command: 'git', args: ['push'], cwd: workspacePath }]);
  });

  it('git backend: a push failure with no stderr at all propagates without retry (non-process-error shape guard)', () => {
    const calls = createFakeRunner([new Error('spawn ENOENT')]);

    expect(() => pushTaskBranch(workspacePath, 'git', 'sandpiper-tasks')).toThrow('spawn ENOENT');
    expect(calls).toEqual([{ command: 'git', args: ['push'], cwd: workspacePath }]);
  });
});

// ─── pullTaskBranch — command sequences ───────────────────────────

describe('pullTaskBranch', () => {
  const workspacePath = '/fake/workspace';

  it('jj backend: issues `jj git fetch`', () => {
    const calls = createFakeRunner();

    pullTaskBranch(workspacePath, 'jj');

    expect(calls).toEqual([{ command: 'jj', args: ['git', 'fetch'], cwd: workspacePath }]);
  });

  it('git backend: issues `git pull`', () => {
    const calls = createFakeRunner();

    pullTaskBranch(workspacePath, 'git');

    expect(calls).toEqual([{ command: 'git', args: ['pull'], cwd: workspacePath }]);
  });
});
