/**
 * Unit tests for the `storage` command group's dispatch logic.
 *
 * These invoke storageCommand (and, for the auto-commit case, taskCommand)
 * in-process via Commander's `parseAsync` — no subprocess, no `bun index.ts`
 * spawn — with the real `resolveStorageConfig`/`detectVcsBackend` (both
 * fs-only, no VCS binary needed) and the real storage-backend/migrate logic,
 * but with git/jj command execution faked via storage-backend's `VcsRunner`
 * seam. This asserts on exactly what the CLI layer does — which commands it
 * issues, in what order, with what messages/exit codes — without spawning
 * real git or jj.
 *
 * Real end-to-end git/jj behavior (does `git worktree add --orphan` actually
 * work, does jj's immutable-commit rule actually get avoided, etc.) is
 * covered by the thin integration sets in storage-backend.integration.test.ts
 * and auto-commit.integration.test.ts — deliberately not duplicated here.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from '@commander-js/extra-typings';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetVcsRunner, setVcsRunner, type VcsCommandResult } from '../core/storage-backend.js';
import { storageCommand } from './storage-cmd.js';
import { taskCommand } from './task-cmd.js';

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

/** Build a minimal root Command wrapping the given subcommands, matching index.ts's -d/-f options. */
function makeProgram(...subcommands: readonly Command[]): Command {
  const program = new Command().exitOverride().option('-d, --dir <path>').option('-f, --format <format>');
  for (const cmd of subcommands) program.addCommand(cmd);
  return program;
}

interface CliResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

/** Minimal shell-like tokenizer: splits on whitespace, honoring "..." quoted spans. */
function tokenize(args: string): string[] {
  const tokens = args.match(/"[^"]*"|\S+/g) ?? [];
  return tokens.map((t) => (t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t));
}

async function runInProcess(program: Command, args: string): Promise<CliResult> {
  const logs: string[] = [];
  const errors: string[] = [];
  const logSpy = vi.spyOn(console, 'log').mockImplementation((msg: unknown) => {
    logs.push(String(msg));
  });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation((msg: unknown) => {
    errors.push(String(msg));
  });
  process.exitCode = undefined;
  try {
    await program.parseAsync(['node', 'trail', ...tokenize(args)], { from: 'node' });
    const exitCode = typeof process.exitCode === 'number' ? process.exitCode : 0;
    return { stdout: logs.join('\n'), stderr: errors.join('\n'), exitCode };
  } finally {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    process.exitCode = undefined;
  }
}

afterEach(() => {
  resetVcsRunner();
});

// ─── storage init — mode: inline (default) ───────────────────────

describe('storage init — inline mode (default)', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'storage-init-inline-test-'));
    mkdirSync(join(rootDir, '.sandpiper', 'tasks'), { recursive: true });
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('reports that inline mode requires no special initialisation, issuing no VCS commands', () => {
    const calls = createFakeRunner();
    const program = makeProgram(storageCommand);

    return runInProcess(program, `--dir ${rootDir} storage init`).then((result) => {
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/inline|already|no.?init/i);
      expect(calls).toEqual([]);
    });
  });
});

// ─── storage init — no VCS, separate-branch config ───────────────

describe('storage init — no VCS repo, separate-branch config', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'storage-init-novcs-test-'));
    mkdirSync(join(rootDir, '.sandpiper', 'tasks'), { recursive: true });
    writeFileSync(
      join(rootDir, '.sandpiper-tasks.json'),
      JSON.stringify({ version_control: { mode: { branch: 'sandpiper-tasks' } } }),
    );
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('exits with error when no VCS repo is detected, issuing no VCS commands', async () => {
    const calls = createFakeRunner();
    const program = makeProgram(storageCommand);

    const result = await runInProcess(program, `--dir ${rootDir} storage init`);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/no VCS|no vcs|repository/i);
    expect(calls).toEqual([]);
  });
});

// ─── storage init — git backend ──────────────────────────────────

describe('storage init — git backend', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'storage-init-git-test-'));
    mkdirSync(join(rootDir, '.git'));
    writeFileSync(
      join(rootDir, '.sandpiper-tasks.json'),
      JSON.stringify({ version_control: { mode: { branch: 'sandpiper-tasks' } } }),
    );
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('issues `git worktree add --orphan -b <branch> <path>`', async () => {
    const calls = createFakeRunner();
    const program = makeProgram(storageCommand);
    const workspacePath = join(rootDir, '.sandpiper', 'tasks');

    const result = await runInProcess(program, `--dir ${rootDir} storage init`);

    expect(result.exitCode).toBe(0);
    expect(calls).toEqual([
      { command: 'git', args: ['worktree', 'add', '--orphan', '-b', 'sandpiper-tasks', workspacePath], cwd: rootDir },
    ]);
  });

  it('adds .sandpiper/tasks/ to .gitignore on the main branch', async () => {
    createFakeRunner();
    const program = makeProgram(storageCommand);

    await runInProcess(program, `--dir ${rootDir} storage init`);

    const gitignore = readFileSync(join(rootDir, '.gitignore'), 'utf-8');
    expect(gitignore.split('\n').map((l) => l.trim())).toContain('.sandpiper/tasks/');
  });

  it('is idempotent when run a second time (workspace path pre-exists, no VCS command issued)', async () => {
    mkdirSync(join(rootDir, '.sandpiper', 'tasks'), { recursive: true });
    const calls = createFakeRunner();
    const program = makeProgram(storageCommand);

    const result = await runInProcess(program, `--dir ${rootDir} storage init`);

    expect(result.exitCode).toBe(0);
    expect(calls).toEqual([]);
  });
});

// ─── storage init — jj backend ───────────────────────────────────

describe('storage init — jj backend', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'storage-init-jj-test-'));
    mkdirSync(join(rootDir, '.jj'));
    writeFileSync(
      join(rootDir, '.sandpiper-tasks.json'),
      JSON.stringify({ version_control: { mode: { branch: 'sandpiper-tasks' } } }),
    );
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('issues `jj workspace add` then `jj bookmark create -r @`', async () => {
    const calls = createFakeRunner();
    const program = makeProgram(storageCommand);
    const workspacePath = join(rootDir, '.sandpiper', 'tasks');

    const result = await runInProcess(program, `--dir ${rootDir} storage init`);

    expect(result.exitCode).toBe(0);
    expect(calls).toEqual([
      {
        command: 'jj',
        args: ['workspace', 'add', workspacePath, '--name', 'tasks', '--revision', 'root()'],
        cwd: rootDir,
      },
      { command: 'jj', args: ['bookmark', 'create', 'sandpiper-tasks', '-r', '@'], cwd: workspacePath },
    ]);
  });

  it('adds .sandpiper/tasks/ to .gitignore on the main branch', async () => {
    createFakeRunner();
    const program = makeProgram(storageCommand);

    await runInProcess(program, `--dir ${rootDir} storage init`);

    const gitignore = readFileSync(join(rootDir, '.gitignore'), 'utf-8');
    expect(gitignore.split('\n').map((l) => l.trim())).toContain('.sandpiper/tasks/');
  });
});

// ─── auto-commit on task mutation ────────────────────────────────

describe('auto-commit on task mutation — git backend', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'auto-commit-cli-test-'));
    mkdirSync(join(rootDir, '.git'));
    writeFileSync(
      join(rootDir, '.sandpiper-tasks.json'),
      JSON.stringify({
        version_control: { mode: { branch: 'sandpiper-tasks' }, auto_commit: true },
      }),
    );
    mkdirSync(join(rootDir, '.sandpiper', 'tasks', 'TST'), { recursive: true });
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('issues a git commit for the new task file after task create when auto_commit is true', async () => {
    const calls = createFakeRunner();
    const program = makeProgram(taskCommand, storageCommand);

    const result = await runInProcess(
      program,
      `--dir ${rootDir} task create -p TST -t "Auto-commit test" --reporter USER`,
    );

    expect(result.exitCode).toBe(0);
    expect(calls).toEqual([
      { command: 'git', args: ['add', '-A'], cwd: join(rootDir, '.sandpiper', 'tasks') },
      {
        command: 'git',
        args: ['commit', '-m', expect.stringContaining('TST-1')],
        cwd: join(rootDir, '.sandpiper', 'tasks'),
      },
    ]);
  });
});

// ─── storage init — external repo ─────────────────────────────────

describe('storage init — external repo, git backend', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'storage-init-ext-test-'));
    mkdirSync(join(rootDir, '.git'));
    writeFileSync(
      join(rootDir, '.sandpiper-tasks.json'),
      JSON.stringify({ version_control: { mode: { branch: '@', repo: 'https://example.invalid/tasks.git' } } }),
    );
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('issues `git clone <repo> <path>`', async () => {
    const calls = createFakeRunner();
    const program = makeProgram(storageCommand);
    const clonePath = join(rootDir, '.sandpiper', 'tasks');

    const result = await runInProcess(program, `--dir ${rootDir} storage init`);

    expect(result.exitCode).toBe(0);
    expect(calls).toEqual([
      { command: 'git', args: ['clone', 'https://example.invalid/tasks.git', clonePath], cwd: rootDir },
    ]);
  });

  it('adds .sandpiper/tasks/ to .gitignore', async () => {
    createFakeRunner();
    const program = makeProgram(storageCommand);

    await runInProcess(program, `--dir ${rootDir} storage init`);

    const gitignore = readFileSync(join(rootDir, '.gitignore'), 'utf-8');
    expect(gitignore.split('\n').map((l) => l.trim())).toContain('.sandpiper/tasks/');
  });
});

// ─── storage migrate ──────────────────────────────────────────────

describe('storage migrate — git backend', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'storage-migrate-test-'));
    mkdirSync(join(rootDir, '.git'));
    // Set up inline tasks (current default mode)
    mkdirSync(join(rootDir, '.sandpiper', 'tasks', 'TST'), { recursive: true });
    writeFileSync(
      join(rootDir, '.sandpiper', 'tasks', 'TST', 'TST-1.md'),
      '---\ntitle: "Existing task"\nstatus: NOT STARTED\nkind: TASK\npriority: HIGH\nassignee: UNASSIGNED\nreporter: USER\ncreated_at: 2026-04-01T00:00:00Z\nupdated_at: 2026-04-01T00:00:00Z\n---\n\n# Existing task\n',
    );
    // Configure separate-branch mode
    writeFileSync(
      join(rootDir, '.sandpiper-tasks.json'),
      JSON.stringify({ version_control: { mode: { branch: 'sandpiper-tasks' } } }),
    );
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('moves inline task files into the separate-branch workspace and issues the worktree-bootstrap command', async () => {
    const calls = createFakeRunner();
    const program = makeProgram(storageCommand);
    const workspacePath = join(rootDir, '.sandpiper', 'tasks');

    const result = await runInProcess(program, `--dir ${rootDir} storage migrate`);

    expect(result.exitCode).toBe(0);
    expect(existsSync(join(workspacePath, 'TST', 'TST-1.md'))).toBe(true);
    expect(calls).toEqual([
      { command: 'git', args: ['worktree', 'add', '--orphan', '-b', 'sandpiper-tasks', workspacePath], cwd: rootDir },
    ]);
  });
});

// ─── storage sync/push/pull ───────────────────────────────────────

describe('storage sync/push/pull — separate-branch, git backend', () => {
  let rootDir: string;
  const workspacePath = (root: string) => join(root, '.sandpiper', 'tasks');

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'storage-sync-test-'));
    mkdirSync(join(rootDir, '.git'));
    mkdirSync(join(rootDir, '.sandpiper', 'tasks'), { recursive: true });
    writeFileSync(
      join(rootDir, '.sandpiper-tasks.json'),
      JSON.stringify({ version_control: { mode: { branch: 'sandpiper-tasks' } } }),
    );
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('storage pull issues `git pull` only', async () => {
    const calls = createFakeRunner();
    const program = makeProgram(storageCommand);

    const result = await runInProcess(program, `--dir ${rootDir} storage pull`);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Pulled');
    expect(calls).toEqual([{ command: 'git', args: ['pull'], cwd: workspacePath(rootDir) }]);
  });

  it('storage push issues `git push` only', async () => {
    const calls = createFakeRunner();
    const program = makeProgram(storageCommand);

    const result = await runInProcess(program, `--dir ${rootDir} storage push`);

    expect(result.exitCode).toBe(0);
    expect(calls).toEqual([{ command: 'git', args: ['push'], cwd: workspacePath(rootDir) }]);
  });

  it('storage sync pulls then pushes, in that order', async () => {
    const calls = createFakeRunner();
    const program = makeProgram(storageCommand);

    const result = await runInProcess(program, `--dir ${rootDir} storage sync`);

    expect(result.exitCode).toBe(0);
    expect(calls).toEqual([
      { command: 'git', args: ['pull'], cwd: workspacePath(rootDir) },
      { command: 'git', args: ['push'], cwd: workspacePath(rootDir) },
    ]);
  });
});

// ─── storage sync/push/pull inline no-op ───────────────────────────

describe('storage sync/push/pull — inline mode no-op', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'storage-sync-noop-test-'));
    mkdirSync(join(rootDir, '.sandpiper', 'tasks'), { recursive: true });
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  for (const subcmd of ['sync', 'push', 'pull'] as const) {
    it(`storage ${subcmd} exits 0, prints informational message, issues no VCS command`, async () => {
      const calls = createFakeRunner();
      const program = makeProgram(storageCommand);

      const result = await runInProcess(program, `--dir ${rootDir} storage ${subcmd}`);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/inline|normal VCS/i);
      expect(calls).toEqual([]);
    });
  }
});
