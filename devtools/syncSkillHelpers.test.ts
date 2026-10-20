import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { syncSkillHelpers } from './syncSkillHelpers.js';

const tempRoots: string[] = [];

function makeTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'sandpiper-skill-helpers-'));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('syncSkillHelpers', () => {
  it('copies package-owned CLI outputs into the source skill directories', async () => {
    const repoRoot = makeTempRoot();
    const trailOutput = join(repoRoot, 'packages', 'trail', 'dist', 'trail');
    const standupOutput = join(repoRoot, 'packages', 'sandpiper-standup-cli', 'dist', 'sandpiper-standup');

    await mkdir(join(trailOutput, '..'), { recursive: true });
    await mkdir(join(standupOutput, '..'), { recursive: true });
    writeFileSync(trailOutput, '#!/usr/bin/env node\ntrail\n');
    writeFileSync(standupOutput, '#!/usr/bin/env node\nstandup\n');

    await syncSkillHelpers(repoRoot);

    const taskScripts = join(repoRoot, 'packages', 'resources', 'skills', 'sandpiper', 'tasks', 'scripts');
    const standupScript = join(
      repoRoot,
      'packages',
      'resources',
      'skills',
      'sandpiper',
      'standup',
      'scripts',
      'sandpiper-standup',
    );

    expect(readFileSync(join(taskScripts, 'trail'), 'utf-8')).toContain('trail');
    expect(readFileSync(join(taskScripts, 'sandpiper-tasks'), 'utf-8')).toContain('trail');
    expect(readFileSync(standupScript, 'utf-8')).toContain('standup');
    expect(statSync(join(taskScripts, 'trail')).mode & 0o111).not.toBe(0);
    expect(statSync(join(taskScripts, 'sandpiper-tasks')).mode & 0o111).not.toBe(0);
    expect(statSync(standupScript).mode & 0o111).not.toBe(0);
  });
});
