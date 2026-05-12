/**
 * Inline-to-separate-branch migration.
 *
 * Moves existing task files from an inline `.sandpiper/tasks/` directory
 * into a freshly bootstrapped separate-branch workspace.
 */

import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addPathToGitignore, initSeparateBranch } from './storage-backend.js';
import type { TaskStorageConfig } from './storage-config.js';
import type { VcsBackend } from './vcs.js';

export interface MigrateOptions {
  readonly rootDir: string;
  readonly config: TaskStorageConfig;
  readonly backend: VcsBackend;
}

/**
 * Migrate inline task storage to a separate branch.
 *
 * Steps:
 * 1. Copy existing task files to a temp location.
 * 2. Remove the inline `.sandpiper/tasks/` directory.
 * 3. Bootstrap the worktree/workspace via `initSeparateBranch`.
 * 4. Copy task files back into the new workspace.
 * 5. Ensure `.sandpiper/tasks/` is gitignored on the main branch.
 *
 * Idempotent if the workspace already exists (tasks files are already present).
 */
export function migrateInlineToSeparateBranch(opts: MigrateOptions): void {
  const { rootDir, config, backend } = opts;
  const vc = config.version_control;

  if (!vc.enabled || (vc.mode.branch === '@' && !vc.mode.repo)) {
    throw new Error(
      'storage migrate requires a separate-branch or external-repo configuration. ' +
        'Update .sandpiper-tasks.json or .sandpiper/settings.json to set a branch name.',
    );
  }

  const workspacePath = join(rootDir, '.sandpiper', 'tasks');

  // If workspace already exists and looks like a worktree, nothing to do
  const isAlreadyWorktree = existsSync(join(workspacePath, '.git')) || existsSync(join(workspacePath, '.jj'));
  if (isAlreadyWorktree) return;

  // 1. Save existing task files to a temp directory
  const tempDir = mkdtempSync(join(tmpdir(), 'sandpiper-migrate-'));
  try {
    if (existsSync(workspacePath)) {
      cpSync(workspacePath, tempDir, { recursive: true });
      rmSync(workspacePath, { recursive: true, force: true });
    }

    // 2. Bootstrap the workspace/worktree
    initSeparateBranch({
      rootDir,
      backend,
      branchName: vc.mode.branch,
      workspacePath,
    });

    // 3. Copy task files back into the workspace
    cpSync(tempDir, workspacePath, { recursive: true });

    // 4. Gitignore the path on the main branch
    addPathToGitignore(rootDir, '.sandpiper/tasks/');

    // Success — clean up the temp backup
    rmSync(tempDir, { recursive: true, force: true });
  } catch (err) {
    // Leave tempDir intact so the user can recover their task files manually.
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Migration failed. Your task files are preserved at: ${tempDir}\n` +
        `To recover: cp -r "${tempDir}/." "${workspacePath}/"\n` +
        `Underlying error: ${msg}`,
    );
  }
}
