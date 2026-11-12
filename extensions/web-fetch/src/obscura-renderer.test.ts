import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createObscuraRenderer } from './obscura-renderer.js';
import { type RenderTools, runCommand } from './render.js';

let dir: string;
const tools: RenderTools = { run: (executable, args) => runCommand(executable, args, { timeoutMs: 5_000 }) };

/** A stand-in browser that records its arguments and runs the given shell lines. */
function fakeObscura(body: string): void {
  const path = join(dir, 'obscura');
  writeFileSync(path, `#!/bin/sh\nprintf '%s' "$*" > "${join(dir, 'args')}"\n${body}\n`);
  chmodSync(path, 0o755);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sp-obscura-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('createObscuraRenderer', () => {
  it('is absent when Obscura is not installed', () => {
    expect(createObscuraRenderer({ PATH: dir })).toBeUndefined();
  });

  it('returns the HTML Obscura prints, waiting for the network and stopping inside the time limit', async () => {
    fakeObscura('printf "<html><body><h1>Rendered</h1></body></html>"');
    const renderer = createObscuraRenderer({ PATH: dir });

    expect(renderer?.id).toBe('obscura');
    expect(await renderer?.render({ url: 'https://example.com/app?a=1&b=2', timeoutMs: 30_000 }, tools)).toEqual({
      html: '<html><body><h1>Rendered</h1></body></html>',
    });
    expect(readFileSync(join(dir, 'args'), 'utf8')).toBe(
      'fetch --dump html --quiet --wait-until networkidle --timeout 25 https://example.com/app?a=1&b=2',
    );
  });

  it('reports a Cloudflare challenge page as blocked', async () => {
    fakeObscura(
      'printf "<html><head><title>Just a moment...</title><script>window._cf_chl_opt = {};</script></head></html>"',
    );

    expect(
      await createObscuraRenderer({ PATH: dir })?.render({ url: 'https://example.com/', timeoutMs: 30_000 }, tools),
    ).toEqual({ html: '', blocked: 'cloudflare bot challenge' });
  });

  it('fails with what Obscura wrote when it exits with an error', async () => {
    fakeObscura('echo "Error: Failed to navigate: Network error" >&2; exit 1');

    await expect(
      createObscuraRenderer({ PATH: dir })?.render({ url: 'https://nonexistent.invalid/', timeoutMs: 30_000 }, tools),
    ).rejects.toThrow('Error: Failed to navigate: Network error');
  });
});
