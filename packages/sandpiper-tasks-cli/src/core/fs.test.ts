import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeFileAtomic } from './fs.js';

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
    const { mkdirSync } = require('node:fs');
    mkdirSync(badDir);

    const badPath = join(dir, 'bad.md');
    writeFileSync(badPath, 'original');

    expect(() => writeFileAtomic(badPath, 'new content')).toThrow();
    // The original .md file should still have its content
    expect(readFileSync(badPath, 'utf-8')).toBe('original');
  });
});
