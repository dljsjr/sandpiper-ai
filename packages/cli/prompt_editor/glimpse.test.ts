import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findGlimpseExecutable, loadGlimpse, openGlimpseWindow } from './glimpse.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'prompt-editor-glimpse-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writeExecutable(path: string, content = '#!/bin/sh\n'): string {
  writeFileSync(path, content, 'utf-8');
  chmodSync(path, 0o755);
  return path;
}

/** A Glimpse package whose open() records its arguments instead of starting the native host. */
function installFakeGlimpse(): string {
  const packageDir = join(root, 'node_modules', 'glimpseui');
  mkdirSync(join(packageDir, 'bin'), { recursive: true });
  mkdirSync(join(packageDir, 'src'));
  writeExecutable(join(packageDir, 'bin', 'glimpse.mjs'), '#!/usr/bin/env node\n');
  writeFileSync(
    join(packageDir, 'src', 'glimpse.mjs'),
    `export function open(html, options) {
      return { html, options, on() { return this; }, send() {}, close() {} };
    }\n`,
    'utf-8',
  );
  const binDir = join(root, 'bin');
  mkdirSync(binDir);
  symlinkSync(join(packageDir, 'bin', 'glimpse.mjs'), join(binDir, 'glimpseui'));
  return binDir;
}

describe('findGlimpseExecutable', () => {
  it('prefers SANDPIPER_GLIMPSEUI over PATH', () => {
    const binDir = installFakeGlimpse();

    expect(findGlimpseExecutable({ SANDPIPER_GLIMPSEUI: '/opt/glimpseui', PATH: binDir })).toBe('/opt/glimpseui');
  });

  it('finds the first executable glimpseui on PATH', () => {
    const first = join(root, 'first');
    const second = join(root, 'second');
    mkdirSync(first);
    mkdirSync(second);
    writeFileSync(join(first, 'glimpseui'), 'not executable', 'utf-8');
    const executable = writeExecutable(join(second, 'glimpseui'));

    expect(findGlimpseExecutable({ PATH: [first, second].join(delimiter) })).toBe(executable);
    expect(findGlimpseExecutable({ PATH: first })).toBeUndefined();
  });
});

describe('loadGlimpse', () => {
  it('imports open() from the package of the glimpseui executable on PATH', async () => {
    const binDir = installFakeGlimpse();

    const glimpse = await loadGlimpse({ PATH: binDir });
    const window = openGlimpseWindow(glimpse, '<p>page</p>', { width: 10, height: 20, title: 'Editor' });

    expect(window).toMatchObject({ html: '<p>page</p>', options: { width: 10, height: 20, title: 'Editor' } });
  });

  it('explains how to point at Glimpse when it is missing', async () => {
    await expect(loadGlimpse({ PATH: root })).rejects.toThrow(/glimpseui is not installed.*SANDPIPER_GLIMPSEUI/);
  });
});
