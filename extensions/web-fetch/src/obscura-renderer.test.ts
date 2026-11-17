import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createObscuraRenderer } from './obscura-renderer.js';
import type { CommandResult, RenderTools } from './render.js';

let dir: string;

/** Put an `obscura` file on PATH, so the renderer counts as installed. The tests never start it. */
function installObscura(): string {
  const path = join(dir, 'obscura');
  writeFileSync(path, '#!/bin/sh\nexit 1\n');
  chmodSync(path, 0o755);
  return path;
}

/** Tools whose `run` records each command and answers it with the given output. */
function answering(output: Partial<CommandResult>) {
  return { run: vi.fn<RenderTools['run']>(async () => ({ stdout: '', stderr: '', exitCode: 0, ...output })) };
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
    const executable = installObscura();
    const tools = answering({ stdout: '<html><body><h1>Rendered</h1></body></html>' });
    const renderer = createObscuraRenderer({ PATH: dir });

    expect(renderer?.id).toBe('obscura');
    expect(await renderer?.render({ url: 'https://example.com/app?a=1&b=2', timeoutMs: 30_000 }, tools)).toEqual({
      html: '<html><body><h1>Rendered</h1></body></html>',
    });
    expect(tools.run.mock.calls).toEqual([
      [
        executable,
        [
          'fetch',
          '--dump',
          'html',
          '--quiet',
          '--wait-until',
          'networkidle',
          '--timeout',
          '25',
          'https://example.com/app?a=1&b=2',
        ],
      ],
    ]);
  });

  it('reports a Cloudflare challenge page as blocked', async () => {
    installObscura();
    const tools = answering({
      stdout: '<html><head><title>Just a moment...</title><script>window._cf_chl_opt = {};</script></head></html>',
    });

    expect(
      await createObscuraRenderer({ PATH: dir })?.render({ url: 'https://example.com/', timeoutMs: 30_000 }, tools),
    ).toEqual({ html: '', blocked: 'cloudflare bot challenge' });
  });

  it('fails with what Obscura wrote when it exits with an error', async () => {
    installObscura();
    const tools = answering({ stderr: 'Error: Failed to navigate: Network error\n', exitCode: 1 });

    await expect(
      createObscuraRenderer({ PATH: dir })?.render({ url: 'https://nonexistent.invalid/', timeoutMs: 30_000 }, tools),
    ).rejects.toThrow('Error: Failed to navigate: Network error');
  });

  it('fails when Obscura cannot start', async () => {
    const executable = installObscura();
    const tools = { run: vi.fn<RenderTools['run']>().mockRejectedValue(new Error(`could not start ${executable}`)) };

    await expect(
      createObscuraRenderer({ PATH: dir })?.render({ url: 'https://example.com/', timeoutMs: 30_000 }, tools),
    ).rejects.toThrow(`could not start ${executable}`);
  });
});
