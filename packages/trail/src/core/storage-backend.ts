/**
 * Storage backend operations: VCS workspace/worktree/clone bootstrap,
 * gitignore management, auto-commit, and push/pull for separate-branch
 * and external-repo task storage modes.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { addPathToGitignore } from './fs.js';
import type { VcsBackend } from './vcs.js';

export { addPathToGitignore };

// ─── Workspace / worktree bootstrap ─────────────────────────────

export interface InitSeparateBranchOptions {
  readonly rootDir: string;
  readonly backend: VcsBackend;
  readonly branchName: string;
  /** Absolute path where the task workspace/worktree will be created. */
  readonly workspacePath: string;
}

export interface InitSeparateBranchResult {
  readonly workspacePath: string;
  readonly branchName: string;
}

/**
 * Bootstrap a separate-branch task workspace in the current repo.
 *
 * - jj backend: `jj workspace add <path> --name tasks --revision 'root()'`
 *   then `jj bookmark create <branch> -r @-` inside the workspace.
 * - git backend: `git worktree add --orphan -b <branch> <path>`
 *
 * Idempotent: if the workspace/worktree already exists at `workspacePath`,
 * returns without error.
 *
 * @throws if the backend is 'none' or an unknown value.
 */
export function initSeparateBranch(opts: InitSeparateBranchOptions): InitSeparateBranchResult {
  if (opts.backend === 'none') {
    throw new Error(
      'Cannot initialize separate-branch storage: no VCS repository detected. ' +
        'Ensure you are inside a git or jj repository before running `storage init`.',
    );
  }

  if (existsSync(opts.workspacePath)) {
    return { workspacePath: opts.workspacePath, branchName: opts.branchName };
  }

  if (opts.backend === 'jj') {
    initJjWorkspace(opts.rootDir, opts.workspacePath, opts.branchName);
  } else {
    initGitWorktree(opts.rootDir, opts.workspacePath, opts.branchName);
  }

  return { workspacePath: opts.workspacePath, branchName: opts.branchName };
}

function initJjWorkspace(rootDir: string, workspacePath: string, branchName: string): void {
  // jj workspace add does not create parent directories
  mkdirSync(workspacePath, { recursive: true });
  run('jj', ['workspace', 'add', workspacePath, '--name', 'tasks', '--revision', 'root()'], rootDir);
  // Point the bookmark at @, not @-: @- is root() in a freshly-created workspace,
  // and git cannot export a ref pointing at the null SHA, causing a warning on every
  // subsequent jj operation. @ is the (empty) working-copy commit, which is a real
  // exportable git object.
  run('jj', ['bookmark', 'create', branchName, '-r', '@'], workspacePath);
}

function initGitWorktree(rootDir: string, workspacePath: string, branchName: string): void {
  run('git', ['worktree', 'add', '--orphan', '-b', branchName, workspacePath], rootDir);
}

// ─── External repo bootstrap ─────────────────────────────────────

export interface InitExternalRepoOptions {
  readonly rootDir: string;
  readonly backend: VcsBackend;
  readonly repoUrl: string;
  readonly clonePath: string;
  readonly branchName: string;
}

/**
 * Bootstrap task storage by cloning an external repository.
 *
 * - jj repo: `jj git clone --colocate <url> <path>`
 * - git repo: `git clone <url> <path>`
 *
 * After cloning, checks out or creates the configured branch.
 * Idempotent: if `clonePath` already exists, returns without error.
 */
export function initExternalRepo(opts: InitExternalRepoOptions): void {
  if (opts.backend === 'none') {
    throw new Error('Cannot initialize external-repo storage: no VCS repository detected.');
  }

  if (existsSync(opts.clonePath)) return;

  if (opts.backend === 'jj') {
    run('jj', ['git', 'clone', '--colocate', opts.repoUrl, opts.clonePath], opts.rootDir);
    if (opts.branchName !== '@') {
      checkoutOrCreateBranchJj(opts.clonePath, opts.branchName);
    }
  } else {
    run('git', ['clone', opts.repoUrl, opts.clonePath], opts.rootDir);
    if (opts.branchName !== '@') {
      checkoutOrCreateBranchGit(opts.clonePath, opts.branchName);
    }
  }
}

function checkoutOrCreateBranchJj(repoPath: string, branch: string): void {
  try {
    // Remote branch exists: point local bookmark at it, then create a mutable
    // working-copy commit on top. jj disallows editing immutable commits
    // (remote-tracking refs are immutable by default), so `jj new` is used
    // instead of `jj edit` to give us a mutable @ we can commit task files to.
    run('jj', ['bookmark', 'set', branch, '-r', `${branch}@origin`], repoPath);
    run('jj', ['new', branch], repoPath);
  } catch {
    // Remote branch absent: create a new local bookmark at the current working copy.
    run('jj', ['bookmark', 'create', branch, '-r', '@'], repoPath);
  }
}

function checkoutOrCreateBranchGit(repoPath: string, branch: string): void {
  try {
    run('git', ['checkout', branch], repoPath);
  } catch {
    run('git', ['checkout', '-b', branch], repoPath);
  }
}

// ─── Commit / push / pull ────────────────────────────────────────

/**
 * Commit all pending changes in the workspace/worktree to the task branch.
 */
export function commitTaskChanges(workspacePath: string, backend: VcsBackend, message: string): void {
  if (backend === 'jj') {
    run('jj', ['commit', '-m', message], workspacePath);
  } else {
    run('git', ['add', '-A'], workspacePath);
    run('git', ['commit', '-m', message], workspacePath);
  }
}

/**
 * Push the task branch to its remote.
 */
export function pushTaskBranch(workspacePath: string, backend: VcsBackend, branchName: string): void {
  if (backend === 'jj') {
    run('jj', ['git', 'push', '--bookmark', branchName], workspacePath);
  } else {
    pushGitWithUpstreamFallback(workspacePath);
  }
}

/**
 * Push the current branch, establishing upstream tracking on first push.
 *
 * Neither separate-branch mode (initGitWorktree's `git worktree add --orphan`)
 * nor external-repo mode's fallback for a branch absent on the remote
 * (checkoutOrCreateBranchGit's `git checkout -b`) ever configure upstream
 * tracking, so a bare `git push` fails on the first auto_push with "no
 * upstream branch" unless push.autoSetupRemote happens to be set globally.
 * Retry once with --set-upstream against origin, using the actual current
 * branch (not the caller's branchName, which may be '@' for "whatever's
 * checked out"). Only the specific no-upstream failure triggers the retry —
 * any other push failure (network, rejected, etc.) propagates.
 */
function pushGitWithUpstreamFallback(workspacePath: string): void {
  try {
    run('git', ['push'], workspacePath);
  } catch (error) {
    if (!isProcessError(error) || !String(error.stderr ?? '').includes('has no upstream branch')) {
      throw error;
    }

    const currentBranch = vcsRunner('git', ['branch', '--show-current'], workspacePath).stdout.trim();
    run('git', ['push', '--set-upstream', 'origin', currentBranch], workspacePath);
  }
}

function isProcessError(error: unknown): error is Error & { readonly stderr?: Buffer | string } {
  return error instanceof Error;
}

/**
 * Pull remote task branch changes into the workspace.
 */
export function pullTaskBranch(workspacePath: string, backend: VcsBackend): void {
  if (backend === 'jj') {
    run('jj', ['git', 'fetch'], workspacePath);
  } else {
    run('git', ['pull'], workspacePath);
  }
}

// ─── Shell helpers ───────────────────────────────────────────────

export interface VcsCommandResult {
  readonly stdout: string;
}

/**
 * A VCS command runner: given a command, its args, and the cwd to run in,
 * either returns the captured stdout or throws (with `.stderr` attached,
 * matching `execFileSync`'s failure shape) on non-zero exit.
 *
 * This is trail's VCS seam. All git/jj invocations in this module funnel
 * through the module-level `vcsRunner`, which tests can swap out via
 * `setVcsRunner` to assert on exactly which commands trail issues — and
 * how it reacts to scripted outputs/failures — without spawning real git
 * or jj processes.
 */
export type VcsRunner = (command: string, args: readonly string[], cwd: string) => VcsCommandResult;

function defaultVcsRunner(command: string, args: readonly string[], cwd: string): VcsCommandResult {
  const stdout = execFileSync(command, args, { cwd, encoding: 'utf-8' });
  return { stdout };
}

let vcsRunner: VcsRunner = defaultVcsRunner;

/**
 * Test-only seam: replace the runner that issues real git/jj commands with
 * a fake. See `storage-backend.test.ts` for the pattern: record invocations,
 * script return values/errors per call, and assert on the exact command
 * sequences trail issues.
 */
export function setVcsRunner(runner: VcsRunner): void {
  vcsRunner = runner;
}

/** Test-only seam: restore the real git/jj-spawning runner. */
export function resetVcsRunner(): void {
  vcsRunner = defaultVcsRunner;
}

function run(command: string, args: readonly string[], cwd: string): void {
  vcsRunner(command, args, cwd);
}
