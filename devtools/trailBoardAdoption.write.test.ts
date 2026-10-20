import { createHash } from 'node:crypto';
import {
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fileManifest, writeBoardFixture, writeFixtureFiles } from './trailBoardAdoption.fixtures.js';
import { applyBoardAdoption, planBoardAdoption } from './trailBoardAdoption.js';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, writeFileSync: vi.fn(actual.writeFileSync), linkSync: vi.fn(actual.linkSync) };
});

const actualFs = await vi.importActual<typeof import('node:fs')>('node:fs');

describe('board adoption application', () => {
  let rootDir: string;
  let tasksDir: string;

  beforeEach(() => {
    vi.mocked(writeFileSync).mockReset().mockImplementation(actualFs.writeFileSync);
    vi.mocked(linkSync).mockReset().mockImplementation(actualFs.linkSync);
    rootDir = mkdtempSync(join(tmpdir(), 'trail-adoption-write-'));
    tasksDir = writeBoardFixture(rootDir);
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('adds only the complete canonical configuration and its parent directory', () => {
    const plan = planBoardAdoption({ rootDir, tasksDir: '.sandpiper/tasks' });
    const before = fileManifest(rootDir);
    const expected = `${JSON.stringify(plan.config, null, 2)}\n`;

    applyBoardAdoption(plan);

    expect(readFileSync(plan.configPath, 'utf8')).toBe(expected);
    expect(fileManifest(rootDir)).toEqual({
      ...before,
      '.trail': 'directory',
      '.trail/config.json': createHash('sha256').update(expected).digest('hex'),
    });
    expect(fileManifest(tasksDir)['index.toon']).toBe(before['.sandpiper/tasks/index.toon']);
  });

  it.each(['.trail.json', 'trail.json', '.trail/config.json'])(
    'leaves equivalent configuration bytes, timestamps, and paths unchanged on repeat: %s',
    (candidate) => {
      const initial = planBoardAdoption({ rootDir, tasksDir: '.sandpiper/tasks' });
      writeFixtureFiles(rootDir, { [candidate]: JSON.stringify(initial.config, null, 4) });
      const plan = planBoardAdoption({ rootDir, tasksDir: '.sandpiper/tasks' });
      const before = fileManifest(rootDir);
      const stat = statSync(join(rootDir, candidate));

      applyBoardAdoption(plan);

      expect(fileManifest(rootDir)).toEqual(before);
      expect(statSync(join(rootDir, candidate)).mtimeMs).toBe(stat.mtimeMs);
      expect(statSync(join(rootDir, candidate)).ino).toBe(stat.ino);
    },
  );

  it.each(['.trail.json', 'trail.json', '.trail/config.json'])(
    'refuses a concurrent conflicting destination without touching either board or configuration: %s',
    (candidate) => {
      const plan = planBoardAdoption({ rootDir, tasksDir: '.sandpiper/tasks' });
      writeFixtureFiles(rootDir, {
        [candidate]: JSON.stringify({ ...plan.config, version_control: { enabled: false } }),
      });
      const before = fileManifest(rootDir);

      expect(() => applyBoardAdoption(plan)).toThrow();

      expect(fileManifest(rootDir)).toEqual(before);
    },
  );

  it('refuses changed legacy input even when its effective values are unchanged', () => {
    writeFixtureFiles(rootDir, { '.sandpiper-tasks.json': JSON.stringify({ version_control: { enabled: false } }) });
    const plan = planBoardAdoption({ rootDir, tasksDir: '.sandpiper/tasks' });
    writeFixtureFiles(rootDir, {
      '.sandpiper-tasks.json': JSON.stringify({ version_control: { enabled: false }, note: 'changed' }),
    });
    const before = fileManifest(rootDir);

    expect(() => applyBoardAdoption(plan)).toThrow(/changed/i);

    expect(fileManifest(rootDir)).toEqual(before);
  });

  it('refuses a replacement task directory at the same path', () => {
    const plan = planBoardAdoption({ rootDir, tasksDir: '.sandpiper/tasks' });
    renameSync(tasksDir, join(rootDir, 'saved-board'));
    mkdirSync(tasksDir);
    const before = fileManifest(rootDir);

    expect(() => applyBoardAdoption(plan)).toThrow(/changed/i);

    expect(fileManifest(rootDir)).toEqual(before);
  });

  it('rechecks an already-adopted result rather than reporting success for a new conflict', () => {
    const config = planBoardAdoption({ rootDir, tasksDir: '.sandpiper/tasks' }).config;
    writeFixtureFiles(rootDir, { '.trail.json': JSON.stringify(config) });
    const plan = planBoardAdoption({ rootDir, tasksDir: '.sandpiper/tasks' });
    writeFixtureFiles(rootDir, { 'trail.json': '{' });
    const before = fileManifest(rootDir);

    expect(() => applyBoardAdoption(plan)).toThrow('trail.json');

    expect(fileManifest(rootDir)).toEqual(before);
  });

  it('does not expose partial configuration or retain temporary files when a write fails', () => {
    const plan = planBoardAdoption({ rootDir, tasksDir: '.sandpiper/tasks' });
    const before = fileManifest(rootDir);
    vi.mocked(writeFileSync).mockImplementationOnce((path) => {
      actualFs.writeFileSync(path, 'partial');
      throw new Error('simulated interrupted write');
    });

    expect(() => applyBoardAdoption(plan)).toThrow('simulated interrupted write');

    expect(existsSync(plan.configPath)).toBe(false);
    expect(fileManifest(rootDir)).toEqual(before);
  });

  it('rechecks higher-priority candidates immediately before installing staged bytes', () => {
    const plan = planBoardAdoption({ rootDir, tasksDir: '.sandpiper/tasks' });
    const before = fileManifest(rootDir);
    vi.mocked(writeFileSync).mockImplementationOnce((path, data, options) => {
      actualFs.writeFileSync(path, data, options);
      actualFs.writeFileSync(join(rootDir, 'trail.json'), '{');
    });

    expect(() => applyBoardAdoption(plan)).toThrow('trail.json');

    expect(fileManifest(rootDir)).toEqual({ ...before, 'trail.json': createHash('sha256').update('{').digest('hex') });
  });

  it('cleans only its physical staging directory when the configuration parent alias changes', () => {
    const original = join(rootDir, 'config-a');
    const replacement = join(rootDir, 'config-b');
    mkdirSync(original);
    mkdirSync(replacement);
    actualFs.symlinkSync(original, join(rootDir, '.trail'), 'dir');
    const plan = planBoardAdoption({ rootDir, tasksDir: '.sandpiper/tasks' });
    let concurrentDirectory = '';
    vi.mocked(writeFileSync).mockImplementationOnce((path, data, options) => {
      actualFs.writeFileSync(path, data, options);
      actualFs.unlinkSync(join(rootDir, '.trail'));
      actualFs.symlinkSync(replacement, join(rootDir, '.trail'), 'dir');
      concurrentDirectory = join(replacement, basename(dirname(String(path))));
      mkdirSync(concurrentDirectory);
      actualFs.writeFileSync(join(concurrentDirectory, 'keep'), 'concurrent data');
    });

    expect(() => applyBoardAdoption(plan)).toThrow(/changed/i);

    expect(fileManifest(original)).toEqual({ '': 'directory' });
    expect(readFileSync(join(concurrentDirectory, 'keep'), 'utf8')).toBe('concurrent data');
  });

  it('cannot replace a destination created after the final recheck', () => {
    const plan = planBoardAdoption({ rootDir, tasksDir: '.sandpiper/tasks' });
    const before = fileManifest(rootDir);
    vi.mocked(linkSync).mockImplementationOnce((existingPath, destination) => {
      actualFs.writeFileSync(destination, 'concurrent configuration', { flag: 'wx' });
      actualFs.linkSync(existingPath, destination);
    });

    expect(() => applyBoardAdoption(plan)).toThrow(/EEXIST/);

    expect(fileManifest(rootDir)).toEqual({
      ...before,
      '.trail': 'directory',
      '.trail/config.json': createHash('sha256').update('concurrent configuration').digest('hex'),
    });
  });
});
