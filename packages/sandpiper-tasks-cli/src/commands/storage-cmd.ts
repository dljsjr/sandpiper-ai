import { join } from 'node:path';
import { Command } from '@commander-js/extra-typings';
import {
  addPathToGitignore,
  initExternalRepo,
  initSeparateBranch,
  pullTaskBranch,
  pushTaskBranch,
} from '../core/storage-backend.js';
import { resolveStorageConfig } from '../core/storage-config.js';
import { detectVcsBackend } from '../core/vcs.js';
import { getRootDir, withErrorHandling } from './helpers.js';

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Resolve the project root directory (the directory that contains `.sandpiper/`).
 * This is the parent-parent of the tasks directory.
 */
function getRootDirFromCmd(
  // biome-ignore lint/suspicious/noExplicitAny: Commander generic params vary
  cmd: Command<any, any, any>,
): string {
  const dir = getRootDir(cmd);
  // --dir points to the project root; tasksDir = join(rootDir, '.sandpiper', 'tasks')
  // We want the project root, which is dir itself.
  return dir ?? process.cwd();
}

// ─── storage init ────────────────────────────────────────────────

const storageInitCommand = new Command('init')
  .description('Initialise task storage for the configured mode')
  .action((_opts, cmd) => {
    withErrorHandling(() => {
      const rootDir = getRootDirFromCmd(cmd);
      const config = resolveStorageConfig(rootDir);
      const vc = config.version_control;

      // Inline mode (@) needs no special bootstrap
      if (!vc.enabled || vc.mode.branch === '@') {
        console.log(
          'Task storage is in inline mode — tasks are tracked on the current branch. ' +
            'No special initialisation required.',
        );
        return;
      }

      const backend = detectVcsBackend(rootDir);
      const workspacePath = join(rootDir, '.sandpiper', 'tasks');

      if (vc.mode.repo) {
        // External repo mode
        initExternalRepo({
          rootDir,
          backend,
          repoUrl: vc.mode.repo,
          clonePath: workspacePath,
          branchName: vc.mode.branch,
        });
        addPathToGitignore(rootDir, '.sandpiper/tasks/');
        console.log(`Initialised external-repo task storage at ${workspacePath}`);
        console.log(`  Remote:  ${vc.mode.repo}`);
        console.log(`  Branch:  ${vc.mode.branch}`);
      } else {
        // Separate-branch in current repo
        initSeparateBranch({
          rootDir,
          backend,
          branchName: vc.mode.branch,
          workspacePath,
        });
        addPathToGitignore(rootDir, '.sandpiper/tasks/');
        console.log(`Initialised separate-branch task storage at ${workspacePath}`);
        console.log(`  Backend: ${backend}`);
        console.log(`  Branch:  ${vc.mode.branch}`);
      }
    });
  });

// ─── storage sync / push / pull ──────────────────────────────────

const storageSyncCommand = new Command('sync')
  .description('Pull remote task changes then push local changes')
  .action((_opts, cmd) => {
    withErrorHandling(() => {
      const rootDir = getRootDirFromCmd(cmd);
      runSyncOperation(rootDir, 'sync');
    });
  });

const storagePushCommand = new Command('push')
  .description('Push local task branch changes to remote')
  .action((_opts, cmd) => {
    withErrorHandling(() => {
      const rootDir = getRootDirFromCmd(cmd);
      runSyncOperation(rootDir, 'push');
    });
  });

const storagePullCommand = new Command('pull').description('Pull remote task branch changes').action((_opts, cmd) => {
  withErrorHandling(() => {
    const rootDir = getRootDirFromCmd(cmd);
    runSyncOperation(rootDir, 'pull');
  });
});

function runSyncOperation(rootDir: string, op: 'sync' | 'push' | 'pull'): void {
  const config = resolveStorageConfig(rootDir);
  const vc = config.version_control;

  if (!vc.enabled || vc.mode.branch === '@') {
    console.log('Task storage is in inline mode. Use your normal VCS workflow for sync.');
    return;
  }

  const workspacePath = join(rootDir, '.sandpiper', 'tasks');
  const backend = detectVcsBackend(rootDir);

  if (op === 'pull' || op === 'sync') {
    pullTaskBranch(workspacePath, backend);
    console.log('Pulled remote task changes.');
  }
  if (op === 'push' || op === 'sync') {
    pushTaskBranch(workspacePath, backend, vc.mode.branch);
    console.log('Pushed local task changes.');
  }
}

// ─── storage migrate ─────────────────────────────────────────────

const storageMigrateCommand = new Command('migrate')
  .description('Move inline tasks to the configured separate-branch or external-repo storage')
  .action((_opts, _cmd) => {
    withErrorHandling(() => {
      // Implemented in TCL-96
      throw new Error('storage migrate is not yet implemented (TCL-96).');
    });
  });

// ─── storage (group) ─────────────────────────────────────────────

export const storageCommand = new Command('storage')
  .description('Manage task storage initialisation and sync')
  .addCommand(storageInitCommand)
  .addCommand(storageSyncCommand)
  .addCommand(storagePushCommand)
  .addCommand(storagePullCommand)
  .addCommand(storageMigrateCommand);
