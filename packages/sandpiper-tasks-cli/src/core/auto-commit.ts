import { join } from 'node:path';
import { commitTaskChanges, pushTaskBranch } from './storage-backend.js';
import type { TaskStorageConfig } from './storage-config.js';
import { detectVcsBackend } from './vcs.js';

/**
 * If the storage config has `auto_commit: true` and the branch is not inline (`"@"`),
 * commit all pending changes in the task workspace with the given message.
 * If `auto_push: true` is also set, push to the remote immediately after.
 *
 * This is called from the CLI mutation layer (emitMutationResult) after every
 * task write when auto_commit is enabled.
 */
export function autoCommitIfEnabled(rootDir: string, config: TaskStorageConfig, message: string): void {
  const vc = config.version_control;
  // Inline mode: enabled, branch="@", no external repo — auto-commit doesn't apply
  if (!vc.enabled || !vc.auto_commit || (vc.mode.branch === '@' && !vc.mode.repo)) return;

  const workspacePath = join(rootDir, '.sandpiper', 'tasks');
  const backend = detectVcsBackend(rootDir);
  commitTaskChanges(workspacePath, backend, message);

  if (vc.auto_push) {
    pushTaskBranch(workspacePath, backend, vc.mode.branch);
  }
}
