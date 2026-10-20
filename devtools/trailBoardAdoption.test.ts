import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fileManifest, writeBoardFixture, writeFixtureFiles } from './trailBoardAdoption.fixtures.js';
import { planBoardAdoption } from './trailBoardAdoption.js';

describe('board adoption planning', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'trail-adoption-plan-'));
    writeBoardFixture(rootDir);
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('plans a complete inline configuration without changing the board or creating output', () => {
    const before = fileManifest(rootDir);

    const plan = planBoardAdoption({ rootDir, tasksDir: '.sandpiper/tasks' });

    expect(plan).toMatchObject({
      disposition: 'create',
      rootDir,
      tasksPath: join(rootDir, '.sandpiper', 'tasks'),
      configPath: join(rootDir, '.trail', 'config.json'),
      config: {
        version: 2,
        tasks_dir: '.sandpiper/tasks',
        version_control: {
          enabled: true,
          mode: { branch: '@' },
          auto_commit: false,
          auto_push: false,
        },
      },
    });
    expect(fileManifest(rootDir)).toEqual(before);
  });

  it('carries a partial legacy branch and automatic commit value into the complete configuration', () => {
    writeFixtureFiles(rootDir, {
      '.sandpiper-tasks.json': JSON.stringify({ version_control: { mode: { branch: 'tasks' }, auto_commit: true } }),
      '.sandpiper/tasks/.jj/repo': 'isolated marker',
    });
    const before = fileManifest(rootDir);

    const plan = planBoardAdoption({ rootDir, tasksDir: '.sandpiper/tasks' });

    expect(plan.legacySource).toBe(join(rootDir, '.sandpiper-tasks.json'));
    expect(plan.config.version_control).toEqual({
      enabled: true,
      mode: { branch: 'tasks' },
      auto_commit: true,
      auto_push: false,
    });
    expect(fileManifest(rootDir)).toEqual(before);
  });

  it('preserves disabled VCS from settings without emitting ignored legacy fields', () => {
    writeFixtureFiles(rootDir, {
      '.sandpiper/settings.json': JSON.stringify({
        theme: 'dark',
        tasks: { version_control: { enabled: false, mode: { branch: 'unused' }, auto_commit: true } },
      }),
    });

    const plan = planBoardAdoption({ rootDir, tasksDir: '.sandpiper/tasks' });

    expect(plan.legacySource).toBe(join(rootDir, '.sandpiper', 'settings.json'));
    expect(plan.config.version_control).toEqual({ enabled: false });
  });

  it.each([
    { version_control: { mode: { branch: 'override' } } },
    { tasks: { version_control: { mode: { branch: 'override' } } } },
  ])('uses a relative explicit legacy source instead of discovery: %j', (override) => {
    writeFixtureFiles(rootDir, {
      '.sandpiper-tasks.json': JSON.stringify({ version_control: { mode: { branch: 'ignored' } } }),
      'custom.json': JSON.stringify(override),
      '.sandpiper/tasks/.jj/repo': 'isolated marker',
    });

    const plan = planBoardAdoption({ rootDir, tasksDir: '.sandpiper/tasks', configFile: 'custom.json' });

    expect(plan.legacySource).toBe(join(rootDir, 'custom.json'));
    expect(plan.config.version_control).toMatchObject({ mode: { branch: 'override' } });
  });

  it('preserves an external repository and both automatic-operation values', () => {
    writeFixtureFiles(rootDir, {
      '.sandpiper-tasks.json': JSON.stringify({
        version_control: {
          mode: { branch: '@', repo: '/repositories/tasks.git' },
          auto_commit: true,
          auto_push: true,
        },
      }),
      '.sandpiper/tasks/.git': 'isolated marker',
    });

    const plan = planBoardAdoption({ rootDir, tasksDir: '.sandpiper/tasks' });

    expect(plan.config.version_control).toEqual({
      enabled: true,
      mode: { branch: '@', repo: '/repositories/tasks.git' },
      auto_commit: true,
      auto_push: true,
    });
  });

  it('refuses malformed winning legacy JSON with its filename, without falling through or writing', () => {
    writeFixtureFiles(rootDir, {
      '.sandpiper-tasks.json': '{',
      '.sandpiper/settings.json': JSON.stringify({ tasks: { version_control: { enabled: false } } }),
    });
    const before = fileManifest(rootDir);

    expect(() => planBoardAdoption({ rootDir, tasksDir: '.sandpiper/tasks' })).toThrow('.sandpiper-tasks.json');

    expect(fileManifest(rootDir)).toEqual(before);
  });

  it.each([
    null,
    [],
    { version_control: 'invalid' },
    { version_control: { enabled: 'false' } },
    { version_control: { mode: [] } },
    { version_control: { auto_commit: 'true' } },
    { version_control: { mode: { branch: '' } } },
    { version_control: { mode: { repo: '' } } },
    { version_control: {}, tasks: { version_control: { enabled: false } } },
    { unrelated: true },
  ])('refuses unsupported or ambiguous explicit legacy input without guessing: %j', (value) => {
    writeFixtureFiles(rootDir, { 'custom.json': JSON.stringify(value) });
    const before = fileManifest(rootDir);

    expect(() => planBoardAdoption({ rootDir, tasksDir: '.sandpiper/tasks', configFile: 'custom.json' })).toThrow(
      'custom.json',
    );

    expect(fileManifest(rootDir)).toEqual(before);
  });

  it.each(['', 'missing', '../outside', '.sandpiper/tasks/APP/APP-1.md'])(
    'refuses a missing, escaping, or non-directory task path: %s',
    (tasksDir) => {
      const before = fileManifest(rootDir);

      expect(() => planBoardAdoption({ rootDir, tasksDir })).toThrow(/task directory/i);

      expect(fileManifest(rootDir)).toEqual(before);
    },
  );

  it('keeps an absolute task directory outside the project in place', () => {
    const outside = mkdtempSync(join(tmpdir(), 'trail-adoption-outside-'));
    try {
      const before = fileManifest(outside);

      const plan = planBoardAdoption({ rootDir, tasksDir: outside });

      expect(plan.tasksPath).toBe(outside);
      expect(plan.config.tasks_dir).toBe(outside);
      expect(fileManifest(outside)).toEqual(before);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it.each(['project root', 'project ancestor', 'configuration directory', 'root alias', 'configuration alias'])(
    'refuses a separate checkout that contains the %s',
    (location) => {
      let projectRoot = rootDir;
      let tasksDir = '.';
      if (location === 'project ancestor') {
        projectRoot = join(rootDir, 'code');
        mkdirSync(projectRoot);
        tasksDir = rootDir;
      } else if (location === 'configuration directory') {
        tasksDir = '.trail';
        mkdirSync(join(rootDir, tasksDir));
      } else if (location === 'root alias') {
        tasksDir = 'alias';
        symlinkSync(rootDir, join(rootDir, tasksDir), 'dir');
      } else if (location === 'configuration alias') {
        tasksDir = 'checkout';
        mkdirSync(join(rootDir, 'checkout', 'configuration'), { recursive: true });
        symlinkSync(join(rootDir, 'checkout', 'configuration'), join(rootDir, '.trail'), 'dir');
      }
      writeFixtureFiles(projectRoot, {
        '.sandpiper-tasks.json': JSON.stringify({ version_control: { mode: { branch: 'tasks' } } }),
      });
      writeFixtureFiles(resolve(projectRoot, tasksDir), { '.jj/repo': 'isolated marker' });
      const before = fileManifest(rootDir);

      expect(() => planBoardAdoption({ rootDir: projectRoot, tasksDir })).toThrow(/root|ancestor|configuration/i);

      expect(fileManifest(rootDir)).toEqual(before);
    },
  );

  it('refuses to describe a separate checkout as inline after legacy default filling', () => {
    writeFixtureFiles(rootDir, { '.sandpiper/tasks/.jj/repo': 'isolated marker' });
    const before = fileManifest(rootDir);

    expect(() => planBoardAdoption({ rootDir, tasksDir: '.sandpiper/tasks' })).toThrow(/inline/i);

    expect(fileManifest(rootDir)).toEqual(before);
  });

  it('refuses separate storage without an existing checkout rather than creating one', () => {
    writeFixtureFiles(rootDir, {
      '.sandpiper-tasks.json': JSON.stringify({ version_control: { mode: { branch: 'tasks' } } }),
    });
    const before = fileManifest(rootDir);

    expect(() => planBoardAdoption({ rootDir, tasksDir: '.sandpiper/tasks' })).toThrow(/checkout/i);

    expect(fileManifest(rootDir)).toEqual(before);
  });

  it('allows an inline root directory and preserves disabled VCS in a marked directory', () => {
    writeFixtureFiles(rootDir, { '.jj/repo': 'isolated root marker' });
    expect(planBoardAdoption({ rootDir, tasksDir: '.' }).tasksPath).toBe(rootDir);
    writeFixtureFiles(rootDir, {
      '.sandpiper-tasks.json': JSON.stringify({ version_control: { enabled: false } }),
      '.sandpiper/tasks/.jj/repo': 'isolated task marker',
    });

    expect(planBoardAdoption({ rootDir, tasksDir: '.sandpiper/tasks' }).config.version_control).toEqual({
      enabled: false,
    });
  });

  it.each(['.trail.json', 'trail.json', '.trail/config.json'])(
    'leaves a semantically equivalent supported configuration unchanged at %s',
    (candidate) => {
      const config = planBoardAdoption({ rootDir, tasksDir: '.sandpiper/tasks' }).config;
      writeFixtureFiles(rootDir, {
        [candidate]: JSON.stringify({ ...config, tasks_dir: join(rootDir, '.sandpiper/tasks') }, null, 4),
      });
      const before = fileManifest(rootDir);

      const plan = planBoardAdoption({ rootDir, tasksDir: '.sandpiper/tasks' });

      expect(plan.disposition).toBe('already-adopted');
      expect(plan.existingConfigPaths).toEqual([join(rootDir, candidate)]);
      expect(fileManifest(rootDir)).toEqual(before);
    },
  );

  it.each(['.trail.json', 'trail.json', '.trail/config.json'])(
    'refuses malformed or conflicting configuration at %s even when another candidate matches',
    (candidate) => {
      const config = planBoardAdoption({ rootDir, tasksDir: '.sandpiper/tasks' }).config;
      for (const content of [
        '{',
        JSON.stringify({ ...config, version: 3 }),
        JSON.stringify({ ...config, version_control: { enabled: false } }),
      ]) {
        writeFixtureFiles(rootDir, {
          '.trail.json': JSON.stringify(config),
          'trail.json': JSON.stringify(config),
          '.trail/config.json': JSON.stringify(config),
          [candidate]: content,
        });
        const before = fileManifest(rootDir);

        expect(() => planBoardAdoption({ rootDir, tasksDir: '.sandpiper/tasks' })).toThrow(candidate);

        expect(fileManifest(rootDir)).toEqual(before);
      }
    },
  );

  it.each(['.sandpiper-tasks.json', '.trail.json', 'trail.json', '.trail/config.json'])(
    'refuses a dangling configuration link rather than ignoring it: %s',
    (candidate) => {
      const path = join(rootDir, candidate);
      mkdirSync(dirname(path), { recursive: true });
      symlinkSync(join(rootDir, 'missing-config'), path);
      const before = fileManifest(rootDir);

      expect(() => planBoardAdoption({ rootDir, tasksDir: '.sandpiper/tasks' })).toThrow(candidate);

      expect(fileManifest(rootDir)).toEqual(before);
    },
  );

  it('requires an existing project root even with disabled VCS and an absolute existing board', () => {
    writeFixtureFiles(rootDir, { 'legacy.json': JSON.stringify({ version_control: { enabled: false } }) });
    const before = fileManifest(rootDir);

    expect(() =>
      planBoardAdoption({
        rootDir: join(rootDir, 'missing-project'),
        tasksDir: join(rootDir, '.sandpiper/tasks'),
        configFile: join(rootDir, 'legacy.json'),
      }),
    ).toThrow(/project root/i);

    expect(fileManifest(rootDir)).toEqual(before);
  });

  it.each([
    { version: 2, tasks_dir: '.sandpiper/tasks', version_control: { enabled: true } },
    {
      version: 2,
      tasks_dir: '.sandpiper/tasks',
      version_control: { enabled: true, mode: { branch: '@' }, auto_commit: false },
    },
    {
      version: 2,
      tasks_dir: '.sandpiper/tasks',
      version_control: { enabled: 'true', mode: { branch: '@' }, auto_commit: false, auto_push: false },
    },
    { version: 2, tasks_dir: '', version_control: { enabled: false } },
    { version: 2, tasks_dir: '.sandpiper/tasks', version_control: { enabled: false, auto_commit: false } },
  ])('does not fill gaps or ignore disabled fields in an existing Trail configuration: %j', (config) => {
    writeFixtureFiles(rootDir, { '.trail.json': JSON.stringify(config) });
    const before = fileManifest(rootDir);

    expect(() => planBoardAdoption({ rootDir, tasksDir: '.sandpiper/tasks' })).toThrow('.trail.json');

    expect(fileManifest(rootDir)).toEqual(before);
  });

  it('does not inspect a lower-priority malformed legacy source', () => {
    writeFixtureFiles(rootDir, {
      '.sandpiper-tasks.json': JSON.stringify({ version_control: { enabled: false } }),
      '.sandpiper/settings.json': '{',
    });

    expect(planBoardAdoption({ rootDir, tasksDir: '.sandpiper/tasks' }).config.version_control).toEqual({
      enabled: false,
    });
  });

  it('allows a relative directory alias outside the project without changing the alias or data', () => {
    const outside = mkdtempSync(join(tmpdir(), 'trail-adoption-alias-'));
    try {
      symlinkSync(outside, join(rootDir, 'board-link'), 'dir');
      const before = fileManifest(rootDir);

      const plan = planBoardAdoption({ rootDir, tasksDir: 'board-link' });

      expect(plan.config.tasks_dir).toBe('board-link');
      expect(fileManifest(rootDir)).toEqual(before);
      expect(fileManifest(outside)).toEqual({ '': 'directory' });
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
