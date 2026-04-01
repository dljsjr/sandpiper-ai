import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectVcsBackend } from './vcs.js';

describe('detectVcsBackend', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'vcs-detect-test-'));
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('returns "jj" when a .jj directory exists', () => {
    mkdirSync(join(rootDir, '.jj'));
    expect(detectVcsBackend(rootDir)).toBe('jj');
  });

  it('returns "jj" when both .jj and .git exist (colocated repo)', () => {
    mkdirSync(join(rootDir, '.jj'));
    mkdirSync(join(rootDir, '.git'));
    expect(detectVcsBackend(rootDir)).toBe('jj');
  });

  it('returns "git" when only .git exists', () => {
    mkdirSync(join(rootDir, '.git'));
    expect(detectVcsBackend(rootDir)).toBe('git');
  });

  it('returns "none" when neither .jj nor .git exist', () => {
    expect(detectVcsBackend(rootDir)).toBe('none');
  });
});
