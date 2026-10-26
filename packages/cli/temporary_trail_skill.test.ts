import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { temporaryTrailSkillPaths } from './temporary_trail_skill.js';

let root: string;
let bin: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'sandpiper-trail-path-'));
  bin = join(root, 'bin');
  mkdirSync(bin);
  vi.stubEnv('HOME', root);
  vi.stubEnv('PATH', bin);
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

describe('temporary Trail skill bridge', () => {
  it('adds no skill when trail is absent from PATH', () => {
    expect(temporaryTrailSkillPaths()).toEqual([]);
  });

  it('finds an executable later in PATH without running it or querying skill discovery', () => {
    const later = join(root, 'later');
    const marker = join(root, 'invoked');
    mkdirSync(later);
    writeFileSync(join(later, 'trail'), `#!/bin/sh\nprintf invoked > "${marker}"\nexit 99\n`, { mode: 0o755 });
    vi.stubEnv('PATH', [bin, later].join(delimiter));
    expect(temporaryTrailSkillPaths()).toEqual([join(root, 'git', 'skills-incubator', 'skills', 'trail')]);
    expect(existsSync(marker)).toBe(false);
  });

  it.skipIf(process.platform === 'win32')('ignores a non-executable file named trail', () => {
    writeFileSync(join(bin, 'trail'), 'not executable');
    chmodSync(join(bin, 'trail'), 0o644);
    expect(temporaryTrailSkillPaths()).toEqual([]);
  });

  it('does not mistake a directory named trail for an executable', () => {
    mkdirSync(join(bin, 'trail'));
    expect(temporaryTrailSkillPaths()).toEqual([]);
  });

  it('checks the current PATH again on reload rather than caching a missing executable', () => {
    expect(temporaryTrailSkillPaths()).toEqual([]);
    writeFileSync(join(bin, 'trail'), '#!/bin/sh\nexit 99\n', { mode: 0o755 });
    expect(temporaryTrailSkillPaths()).toEqual([join(root, 'git', 'skills-incubator', 'skills', 'trail')]);
  });
});
