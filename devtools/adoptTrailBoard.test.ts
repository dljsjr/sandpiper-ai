import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fileManifest, writeBoardFixture, writeFixtureFiles } from './trailBoardAdoption.fixtures.js';

const cliPath = join(dirname(fileURLToPath(import.meta.url)), 'adoptTrailBoard.ts');
const bunPath = execFileSync('bun', ['-e', 'process.stdout.write(process.execPath)'], { encoding: 'utf8' });

describe('board adoption CLI', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'trail-adoption-cli-'));
    writeBoardFixture(rootDir);
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  function run(...args: string[]) {
    return spawnSync(bunPath, ['--bun', cliPath, ...args], { cwd: rootDir, encoding: 'utf8' });
  }

  it('reports the complete dry-run plan without writing or requiring VCS executables', () => {
    const before = fileManifest(rootDir);

    const result = spawnSync(
      bunPath,
      ['--bun', cliPath, '--dir', rootDir, '--tasks-dir', '.sandpiper/tasks', '--dry-run'],
      {
        cwd: rootDir,
        encoding: 'utf8',
        env: { ...process.env, PATH: join(rootDir, 'no-executables') },
      },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      result: 'dry-run',
      action: 'create',
      source: 'legacy defaults',
      task_directory: join(rootDir, '.sandpiper/tasks'),
      configuration_file: join(rootDir, '.trail/config.json'),
      configuration: { version: 2, tasks_dir: '.sandpiper/tasks' },
    });
    expect(fileManifest(rootDir)).toEqual(before);
  });

  it('requires an explicit task directory before reading or changing the board', () => {
    const before = fileManifest(rootDir);

    const result = run('--dir', rootDir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--tasks-dir');
    expect(fileManifest(rootDir)).toEqual(before);
  });

  it('uses the current directory as the project root when dir is omitted', () => {
    const result = run('--tasks-dir', '.sandpiper/tasks', '--dry-run');

    expect(result.status, result.stderr).toBe(0);
    expect(realpathSync(JSON.parse(result.stdout).task_directory)).toBe(
      realpathSync(join(rootDir, '.sandpiper/tasks')),
    );
  });

  it('creates usable complete configuration and leaves an equivalent repeat unchanged', () => {
    const created = run('--dir', rootDir, '--tasks-dir', '.sandpiper/tasks');
    expect(created.status, created.stderr).toBe(0);
    expect(JSON.parse(created.stdout).result).toBe('created');
    expect(JSON.parse(readFileSync(join(rootDir, '.trail/config.json'), 'utf8'))).toMatchObject({
      version: 2,
      tasks_dir: '.sandpiper/tasks',
    });
    const before = fileManifest(rootDir);

    const repeated = run('--dir', rootDir, '--tasks-dir', '.sandpiper/tasks');

    expect(repeated.status, repeated.stderr).toBe(0);
    expect(JSON.parse(repeated.stdout).result).toBe('already-adopted');
    expect(fileManifest(rootDir)).toEqual(before);
  });

  it('uses an explicit settings-shaped source and preserves disabled VCS', () => {
    writeFixtureFiles(rootDir, { 'custom.json': JSON.stringify({ tasks: { version_control: { enabled: false } } }) });

    const result = run('--dir', rootDir, '--tasks-dir', '.sandpiper/tasks', '--config-file', 'custom.json');

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).source).toBe(join(rootDir, 'custom.json'));
    expect(JSON.parse(readFileSync(join(rootDir, '.trail/config.json'), 'utf8')).version_control).toEqual({
      enabled: false,
    });
  });

  it('reports the actual existing configuration filename for an already-adopted board', () => {
    writeFixtureFiles(rootDir, {
      '.trail.json': JSON.stringify({
        version: 2,
        tasks_dir: '.sandpiper/tasks',
        version_control: { enabled: true, mode: { branch: '@' }, auto_commit: false, auto_push: false },
      }),
    });
    const before = fileManifest(rootDir);

    const result = run('--dir', rootDir, '--tasks-dir', '.sandpiper/tasks');

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).configuration_file).toBe(join(rootDir, '.trail.json'));
    expect(fileManifest(rootDir)).toEqual(before);
  });

  it('refuses conflicts with a diagnostic and nonzero exit, not a success report', () => {
    writeFixtureFiles(rootDir, { '.trail.json': '{' });
    const before = fileManifest(rootDir);

    const result = run('--dir', rootDir, '--tasks-dir', '.sandpiper/tasks');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('.trail.json');
    expect(result.stdout).toBe('');
    expect(fileManifest(rootDir)).toEqual(before);
  });
});
