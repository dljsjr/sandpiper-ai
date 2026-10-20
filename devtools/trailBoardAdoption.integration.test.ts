import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fileManifest, writeFixtureFiles } from './trailBoardAdoption.fixtures.js';
import {
  type AdoptionFixtureKind,
  boardDataManifest,
  createRepositoryBoard,
  fixtureVcsState,
} from './trailBoardAdoption.repositories.js';

const cliPath = join(dirname(fileURLToPath(import.meta.url)), 'adoptTrailBoard.ts');
const bunPath = execFileSync('bun', ['-e', 'process.stdout.write(process.execPath)'], { encoding: 'utf8' });

describe('board adoption against real Git and jj repositories', () => {
  let sandbox: string;

  beforeEach(() => {
    sandbox = mkdtempSync(join(tmpdir(), 'trail-adoption-repository-'));
  });

  afterEach(() => {
    rmSync(sandbox, { recursive: true, force: true });
  });

  it.each<AdoptionFixtureKind>(['git', 'jj', 'external', 'inline', 'disabled'])(
    'preserves board bytes, workspace state, and unrelated work through dry-run, apply, and repeat: %s',
    (kind) => {
      const { rootDir, tasksDir, backend } = createRepositoryBoard(sandbox, kind);
      const taskArgument = kind === 'external' ? tasksDir : '.sandpiper/tasks';
      const beforeData = boardDataManifest(tasksDir);
      const beforeVcs = fixtureVcsState(rootDir, tasksDir, backend);
      const source = join(rootDir, kind === 'disabled' ? '.sandpiper/settings.json' : '.sandpiper-tasks.json');
      const sourceBytes = readFileSync(source);
      const wipBytes = readFileSync(join(rootDir, 'unrelated-wip.txt'));
      const beforeFiles = fileManifest(rootDir);
      const invoke = (dryRun: boolean) =>
        spawnSync(
          bunPath,
          ['--bun', cliPath, '--dir', rootDir, '--tasks-dir', taskArgument, ...(dryRun ? ['--dry-run'] : [])],
          { cwd: sandbox, encoding: 'utf8' },
        );

      const dryRun = invoke(true);

      expect(dryRun.status, dryRun.stderr).toBe(0);
      expect(fileManifest(rootDir)).toEqual(beforeFiles);
      expect(boardDataManifest(tasksDir)).toEqual(beforeData);
      expect(fixtureVcsState(rootDir, tasksDir, backend)).toEqual(beforeVcs);
      const applied = invoke(false);
      expect(applied.status, applied.stderr).toBe(0);
      const config = JSON.parse(readFileSync(join(rootDir, '.trail/config.json'), 'utf8'));
      expect(config).toMatchObject({ version: 2, tasks_dir: taskArgument });
      expect(config.version_control).toEqual(
        kind === 'disabled'
          ? { enabled: false }
          : {
              enabled: true,
              mode: { branch: kind === 'inline' ? '@' : 'tasks', ...(kind === 'external' ? { repo: tasksDir } : {}) },
              auto_commit: kind !== 'inline',
              auto_push: false,
            },
      );
      expect(boardDataManifest(tasksDir)).toEqual(beforeData);
      expect(fixtureVcsState(rootDir, tasksDir, backend)).toEqual(beforeVcs);
      expect(readFileSync(source)).toEqual(sourceBytes);
      expect(readFileSync(join(rootDir, 'unrelated-wip.txt'))).toEqual(wipBytes);
      const adoptedFiles = fileManifest(rootDir);
      const repeated = invoke(false);
      expect(repeated.status, repeated.stderr).toBe(0);
      expect(JSON.parse(repeated.stdout).result).toBe('already-adopted');
      expect(fileManifest(rootDir)).toEqual(adoptedFiles);
      expect(boardDataManifest(tasksDir)).toEqual(beforeData);
      expect(fixtureVcsState(rootDir, tasksDir, backend)).toEqual(beforeVcs);
    },
  );

  it('leaves a real jj workspace and all files unchanged when configuration conflicts', () => {
    const { rootDir, tasksDir, backend } = createRepositoryBoard(sandbox, 'jj');
    writeFixtureFiles(rootDir, { '.trail.json': '{' });
    const beforeData = boardDataManifest(tasksDir);
    const beforeVcs = fixtureVcsState(rootDir, tasksDir, backend);
    const beforeFiles = fileManifest(rootDir);

    const result = spawnSync(bunPath, ['--bun', cliPath, '--dir', rootDir, '--tasks-dir', '.sandpiper/tasks'], {
      cwd: sandbox,
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('.trail.json');
    expect(fileManifest(rootDir)).toEqual(beforeFiles);
    expect(boardDataManifest(tasksDir)).toEqual(beforeData);
    expect(fixtureVcsState(rootDir, tasksDir, backend)).toEqual(beforeVcs);
  });
});
