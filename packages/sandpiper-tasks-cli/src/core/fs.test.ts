import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addPathToGitignore, writeFileAtomic } from './fs.js';

describe('writeFileAtomic', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'fs-test-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('should write content to the target path', () => {
    const path = join(dir, 'test.md');
    writeFileAtomic(path, 'hello');
    expect(readFileSync(path, 'utf-8')).toBe('hello');
  });

  it('should not leave a .tmp file after success', () => {
    const path = join(dir, 'test.md');
    writeFileAtomic(path, 'hello');
    expect(existsSync(`${path}.tmp`)).toBe(false);
  });

  it('should overwrite an existing file atomically', () => {
    const path = join(dir, 'test.md');
    writeFileSync(path, 'original');
    writeFileAtomic(path, 'updated');
    expect(readFileSync(path, 'utf-8')).toBe('updated');
  });

  it('should preserve original file if write to tmp fails', () => {
    const path = join(dir, 'test.md');
    writeFileSync(path, 'original');

    // Write to a path where the .tmp location is a directory — will fail
    const badDir = join(dir, 'bad.md.tmp');
    rmSync(badDir, { force: true });
    // Create a directory where the .tmp file would go — writeFileSync will throw
    mkdirSync(badDir);

    const badPath = join(dir, 'bad.md');
    writeFileSync(badPath, 'original');

    expect(() => writeFileAtomic(badPath, 'new content')).toThrow();
    // The original .md file should still have its content
    expect(readFileSync(badPath, 'utf-8')).toBe('original');
  });
});

describe('addPathToGitignore', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gitignore-test-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates .gitignore with the entry when none exists', () => {
    addPathToGitignore(dir, '.sandpiper/tasks/');
    const lines = readFileSync(join(dir, '.gitignore'), 'utf-8')
      .split('\n')
      .map((l) => l.trim());
    expect(lines).toContain('.sandpiper/tasks/');
  });

  it('appends entry to an existing .gitignore that lacks it', () => {
    writeFileSync(join(dir, '.gitignore'), '*.log\n');
    addPathToGitignore(dir, '.sandpiper/tasks/');
    const content = readFileSync(join(dir, '.gitignore'), 'utf-8');
    expect(content).toContain('*.log');
    expect(content.split('\n').map((l) => l.trim())).toContain('.sandpiper/tasks/');
  });

  it('does not duplicate an entry already present', () => {
    addPathToGitignore(dir, '.sandpiper/tasks/');
    addPathToGitignore(dir, '.sandpiper/tasks/');
    const matches = readFileSync(join(dir, '.gitignore'), 'utf-8')
      .split('\n')
      .filter((l) => l.trim() === '.sandpiper/tasks/');
    expect(matches).toHaveLength(1);
  });
});
