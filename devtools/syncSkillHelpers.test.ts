import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
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
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('syncSkillHelpers', () => {
  it('copies the standup helper without requiring or creating a task CLI', async () => {
    const repoRoot = makeTempRoot();
    const standupOutput = join(repoRoot, 'packages', 'sandpiper-standup-cli', 'dist', 'sandpiper-standup');
    await mkdir(join(standupOutput, '..'), { recursive: true });
    writeFileSync(standupOutput, '#!/usr/bin/env node\nstandup\n');
    await syncSkillHelpers(repoRoot);
    const skills = join(repoRoot, 'packages', 'resources', 'skills');
    const standupScript = join(skills, 'standup', 'scripts', 'sandpiper-standup');
    expect(readFileSync(standupScript, 'utf-8')).toContain('standup');
    expect(statSync(standupScript).mode & 0o111).not.toBe(0);
    expect(existsSync(join(skills, 'tasks'))).toBe(false);
  });
});
