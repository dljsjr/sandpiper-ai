import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrateInlineToSeparateBranch } from './migrate.js';
import { DEFAULT_STORAGE_CONFIG } from './storage-config.js';

const SEPARATE_BRANCH_CONFIG = {
  ...DEFAULT_STORAGE_CONFIG,
  version_control: {
    ...DEFAULT_STORAGE_CONFIG.version_control,
    mode: { branch: 'tasks' },
  },
};

describe('migrateInlineToSeparateBranch', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'migrate-test-'));
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('throws when config is inline mode', () => {
    expect(() =>
      migrateInlineToSeparateBranch({
        rootDir,
        config: DEFAULT_STORAGE_CONFIG,
        backend: 'git',
      }),
    ).toThrow('separate-branch or external-repo');
  });

  it('preserves task files in a recoverable temp dir when bootstrap fails', () => {
    // Arrange: inline tasks exist, backend is 'none' so initSeparateBranch will throw
    const workspacePath = join(rootDir, '.sandpiper', 'tasks', 'TST');
    mkdirSync(workspacePath, { recursive: true });
    writeFileSync(join(workspacePath, 'TST-1.md'), '# Important task\n');

    let caughtError: Error | undefined;
    try {
      migrateInlineToSeparateBranch({
        rootDir,
        config: SEPARATE_BRANCH_CONFIG,
        backend: 'none', // forces initSeparateBranch to throw
      });
    } catch (e) {
      caughtError = e as Error;
    }

    // Should have thrown
    expect(caughtError).toBeDefined();

    // Error message should contain the recovery path
    expect(caughtError?.message).toMatch(/preserved at/i);

    // Extract the recovery path from the error message and verify files are there
    const match = caughtError?.message.match(/preserved at:\s*(\S+)/);
    expect(match).not.toBeNull();
    const recoveryPath = match?.[1];
    expect(recoveryPath).toBeDefined();
    expect(existsSync(join(recoveryPath!, 'TST', 'TST-1.md'))).toBe(true);

    // Clean up the recovery dir ourselves since the function left it intentionally
    if (recoveryPath) rmSync(recoveryPath, { recursive: true, force: true });
  });
});
