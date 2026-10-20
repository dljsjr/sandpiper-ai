import { execFileSync } from 'node:child_process';
import { lstatSync, mkdirSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { updateIndex } from '../packages/trail/src/core/index-update.js';
import { fileManifest, writeBoardFixture, writeFixtureFiles } from './trailBoardAdoption.fixtures.js';

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export function fixtureVcs(command: 'git' | 'jj', cwd: string, args: readonly string[]): string {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')));
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...env,
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_SYSTEM: '/dev/null',
      GIT_OPTIONAL_LOCKS: '0',
      JJ_CONFIG: join(repositoryRoot, 'packages/trail/test-fixtures/jj-test-config.toml'),
    },
  });
}

export type AdoptionFixtureKind = 'git' | 'jj' | 'external' | 'inline' | 'disabled';

export function createRepositoryBoard(
  sandbox: string,
  kind: AdoptionFixtureKind,
): {
  readonly rootDir: string;
  readonly tasksDir: string;
  readonly backend: 'git' | 'jj';
} {
  const rootDir = join(sandbox, 'code');
  const backend = kind === 'jj' ? 'jj' : 'git';
  mkdirSync(rootDir);
  if (backend === 'jj') fixtureVcs('jj', rootDir, ['git', 'init', '--colocate']);
  else initializeGit(rootDir, 'main');
  let tasksDir = join(rootDir, '.sandpiper/tasks');
  mkdirSync(dirname(tasksDir), { recursive: true });
  if (kind === 'git') fixtureVcs('git', rootDir, ['worktree', 'add', '--orphan', '-b', 'tasks', tasksDir]);
  if (kind === 'jj') {
    fixtureVcs('jj', rootDir, ['workspace', 'add', tasksDir, '--name', 'tasks', '--revision', 'root()']);
    fixtureVcs('jj', tasksDir, ['bookmark', 'create', 'tasks', '-r', '@']);
  }
  if (kind === 'external') {
    const link = tasksDir;
    tasksDir = join(sandbox, 'external-tasks');
    mkdirSync(tasksDir);
    initializeGit(tasksDir, 'tasks');
    symlinkSync(tasksDir, link, 'dir');
  }
  writeBoardFixture(rootDir);
  rmSync(join(tasksDir, 'index.toon'));
  updateIndex(tasksDir);
  if (kind === 'git' || kind === 'external') {
    fixtureVcs('git', tasksDir, ['add', '-A']);
    fixtureVcs('git', tasksDir, ['commit', '-m', 'Seed task board']);
  } else if (kind === 'jj') fixtureVcs('jj', tasksDir, ['commit', '-m', 'Seed task board']);
  writeFixtureFiles(rootDir, {
    '.gitignore': '.sandpiper/tasks/\n',
    'unrelated-wip.txt': 'Keep this code work unchanged.\n',
  });
  const vc =
    kind === 'disabled'
      ? { enabled: false }
      : {
          mode: { branch: kind === 'inline' ? '@' : 'tasks', ...(kind === 'external' ? { repo: tasksDir } : {}) },
          auto_commit: kind !== 'inline',
        };
  writeFixtureFiles(
    rootDir,
    kind === 'disabled'
      ? { '.sandpiper/settings.json': JSON.stringify({ tasks: { version_control: vc } }) }
      : { '.sandpiper-tasks.json': JSON.stringify({ version_control: vc }) },
  );
  if (backend === 'jj') fixtureVcs('jj', rootDir, ['status']);
  return { rootDir, tasksDir, backend };
}

function initializeGit(rootDir: string, branch: string): void {
  fixtureVcs('git', rootDir, ['init', '-b', branch]);
  fixtureVcs('git', rootDir, ['config', 'user.name', 'Adoption test']);
  fixtureVcs('git', rootDir, ['config', 'user.email', 'adoption@example.invalid']);
  fixtureVcs('git', rootDir, ['config', 'commit.gpgsign', 'false']);
  fixtureVcs('git', rootDir, ['commit', '--allow-empty', '-m', 'Initial fixture']);
}

export function boardDataManifest(tasksDir: string): Readonly<Record<string, string>> {
  return Object.fromEntries(
    readdirSync(tasksDir)
      .filter((name) => name !== '.git' && name !== '.jj')
      .flatMap((name) =>
        Object.entries(fileManifest(join(tasksDir, name))).map(([path, value]) => [join(name, path), value]),
      ),
  );
}

export function fixtureVcsState(rootDir: string, tasksDir: string, backend: 'git' | 'jj'): readonly string[] {
  if (backend === 'jj') {
    return [
      fixtureVcs('jj', rootDir, ['--ignore-working-copy', 'workspace', 'list']),
      fixtureVcs('jj', rootDir, ['--ignore-working-copy', 'bookmark', 'list']),
      ...[rootDir, tasksDir].map((cwd) =>
        fixtureVcs('jj', cwd, ['--ignore-working-copy', 'log', '-r', '@', '--no-graph', '-T', 'commit_id']),
      ),
    ];
  }
  const state = [
    fixtureVcs('git', rootDir, ['rev-parse', 'HEAD']),
    fixtureVcs('git', rootDir, ['worktree', 'list', '--porcelain']),
    fixtureVcs('git', rootDir, ['for-each-ref', '--format=%(refname) %(objectname)']),
  ];
  if (tasksDir !== join(rootDir, '.sandpiper/tasks') || lstatSync(join(tasksDir, '.git'), { throwIfNoEntry: false })) {
    state.push(fixtureVcs('git', tasksDir, ['rev-parse', 'HEAD']));
  }
  return state;
}
