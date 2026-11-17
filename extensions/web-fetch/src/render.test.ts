import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findExecutable,
  NO_TIME_LIMIT,
  RendererCollector,
  RendererFetchAdapter,
  type RenderResult,
  runCommand,
  type WebFetchRenderer,
} from './render.js';

let dir: string;

function script(name: string, body: string, mode = 0o755): string {
  const path = join(dir, name);
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, mode);
  return path;
}

function renderer(id: string, result: Partial<RenderResult> = {}): WebFetchRenderer {
  return { id, render: vi.fn(async () => ({ html: `<html><body>${id}</body></html>`, ...result })) };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sp-render-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('findExecutable', () => {
  it('finds an executable file on PATH and ignores one that is not executable', () => {
    const browser = script('browser', 'exit 0');
    script('plain', 'exit 0', 0o644);

    expect(findExecutable('browser', dir)).toBe(browser);
    expect(findExecutable('plain', dir)).toBeUndefined();
    expect(findExecutable('browser', '')).toBeUndefined();
    expect(findExecutable(browser, '')).toBe(browser);
  });
});

describe('runCommand', () => {
  it('passes each argument through unchanged, with no shell', async () => {
    const marker = join(dir, 'marker');
    const echo = script('echo-args', 'printf "%s|%s" "$#" "$2"');

    const result = await runCommand(echo, ['--flag', `https://example.com/?a=1&b=$(touch ${marker});\`id\``], {
      timeoutMs: NO_TIME_LIMIT,
    });

    expect(result).toEqual({
      stdout: `2|https://example.com/?a=1&b=$(touch ${marker});\`id\``,
      stderr: '',
      exitCode: 0,
    });
    expect(existsSync(marker)).toBe(false);
  });

  it('returns the output and exit code of a command that fails, so the caller can read its report', async () => {
    const failing = script('failing', 'printf "partial"; echo "cause" >&2; exit 3');

    expect(await runCommand(failing, [], { timeoutMs: NO_TIME_LIMIT })).toEqual({
      stdout: 'partial',
      stderr: 'cause\n',
      exitCode: 3,
    });
  });

  it('stops a command that runs past the time limit', async () => {
    const slow = script('slow', 'exec sleep 10');
    const started = Date.now();

    await expect(runCommand(slow, [], { timeoutMs: 200 })).rejects.toThrow('no result after 200 ms');
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it('stops a command when the caller aborts it', async () => {
    const slow = script('slow', 'exec sleep 10');
    const controller = new AbortController();
    const started = Date.now();
    setTimeout(() => controller.abort(), 50);

    const result = runCommand(slow, [], { timeoutMs: 5_000, signal: controller.signal });

    await expect(result).rejects.toThrow(/abort/i);
    await expect(result).rejects.not.toThrow(/could not start/);
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it('reports a command that cannot start', async () => {
    await expect(runCommand(join(dir, 'missing'), [], { timeoutMs: NO_TIME_LIMIT })).rejects.toThrow('could not start');
  });

  // A missing command shows whether runCommand tried to start it: only an accepted limit reaches "could not start".
  it.each([1, 30_000, 2 ** 31 - 1])('accepts a time limit of %d ms', async (timeoutMs) => {
    await expect(runCommand(join(dir, 'missing'), [], { timeoutMs })).rejects.toThrow('could not start');
  });

  it.each([Number.POSITIVE_INFINITY, Number.NaN, -1, 1.5, 2 ** 31])(
    'refuses a time limit of %d ms before starting the command',
    async (timeoutMs) => {
      const result = runCommand(join(dir, 'missing'), [], { timeoutMs });

      await expect(result).rejects.toThrow(
        `timeoutMs must be NO_TIME_LIMIT (0) or a whole number of milliseconds from 1 to 2147483647, not ${timeoutMs}`,
      );
      await expect(result).rejects.toBeInstanceOf(RangeError);
    },
  );
});

describe('RendererCollector', () => {
  it('lists the registered renderers in id order, whatever order they arrived in', () => {
    const collector = new RendererCollector();
    collector.add(renderer('obscura'));
    collector.add(renderer('lightpanda'));
    collector.add(renderer('another'));

    expect(collector.renderers().map((entry) => entry.id)).toEqual(['another', 'lightpanda', 'obscura']);
  });

  it('lists nothing when no renderer is registered', () => {
    expect(new RendererCollector().renderers()).toEqual([]);
  });

  it('keeps the first renderer registered under an id and acknowledges only that one', () => {
    const collector = new RendererCollector();
    const first = { ...renderer('obscura'), acknowledge: vi.fn() };
    const second = { ...renderer(' obscura '), acknowledge: vi.fn() };
    collector.add(first);
    collector.add(second);

    expect(collector.renderers().map((entry) => entry.render)).toEqual([first.render]);
    expect(first.acknowledge).toHaveBeenCalledTimes(1);
    expect(second.acknowledge).not.toHaveBeenCalled();
  });

  it.each([
    null,
    'obscura',
    { id: 'no-render' },
    { id: '', render: () => undefined },
    { id: 'x', render: 'not a function' },
    { id: 'none', render: () => undefined },
    { id: ' None ', render: () => undefined },
  ])('ignores a registration that is not a renderer: %j', (value) => {
    const collector = new RendererCollector();
    collector.add(value);

    expect(collector.renderers()).toEqual([]);
  });
});

describe('RendererFetchAdapter', () => {
  it('gives the renderer a normalized URL, a time limit and a command runner', async () => {
    const run = vi.fn<typeof runCommand>(async (_executable, args) => ({
      stdout: `<html><body>${args[0]}</body></html>`,
      stderr: '',
      exitCode: 0,
    }));
    const spy = vi.fn();
    const adapter = new RendererFetchAdapter(
      {
        id: 'echo',
        render: async (request, tools) => {
          spy(request);
          return { html: (await tools.run('echo-browser', [request.url])).stdout };
        },
      },
      { timeoutMs: 4_000, run },
    );
    const { signal } = new AbortController();

    const result = await adapter.fetch('HTTPS://Example.com/a b?q=1&r=2', { signal });

    expect(spy).toHaveBeenCalledWith({ url: 'https://example.com/a%20b?q=1&r=2', timeoutMs: 4_000 });
    expect(run.mock.calls).toEqual([
      ['echo-browser', ['https://example.com/a%20b?q=1&r=2'], { timeoutMs: 4_000, signal }],
    ]);
    expect(result).toEqual({
      url: 'https://example.com/a%20b?q=1&r=2',
      statusCode: 200,
      body: '<html><body>https://example.com/a%20b?q=1&r=2</body></html>',
      contentType: 'text/html',
    });
  });

  it('stops the commands the renderer runs when the caller aborts', async () => {
    // Like runCommand, the fake runs until the signal aborts it, then rejects with the abort reason.
    const run = vi.fn<typeof runCommand>(
      (_executable, _args, { signal }) =>
        new Promise((_resolve, reject) => {
          if (signal?.aborted) return reject(signal.reason);
          signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
        }),
    );
    const adapter = new RendererFetchAdapter(
      { id: 'slow', render: async (_request, tools) => ({ html: (await tools.run('slow-browser', [])).stdout }) },
      { timeoutMs: 5_000, run },
    );
    const controller = new AbortController();

    const result = adapter.fetch('https://example.com/', { signal: controller.signal });
    controller.abort();

    await expect(result).rejects.toThrow(/abort/i);
    expect(run.mock.calls).toEqual([['slow-browser', [], { timeoutMs: 5_000, signal: controller.signal }]]);
  });

  it('runs the renderer commands with runCommand when no runner is given', async () => {
    const adapter = new RendererFetchAdapter({
      id: 'missing',
      render: async (_request, tools) => ({ html: (await tools.run(join(dir, 'missing'), [])).stdout }),
    });

    await expect(adapter.fetch('https://example.com/')).rejects.toThrow(
      'Rendering with missing failed: could not start',
    );
  });

  it('uses the final URL, status, media type and Link header the renderer reports', async () => {
    const adapter = new RendererFetchAdapter(
      renderer('full', {
        url: 'https://example.com/final',
        statusCode: 404,
        contentType: 'Text/HTML; charset=utf-8',
        linkHeader: '</llms.txt>; rel="describedby"',
      }),
    );

    expect(await adapter.fetch('https://example.com/start')).toEqual({
      url: 'https://example.com/final',
      statusCode: 404,
      body: '<html><body>full</body></html>',
      contentType: 'text/html',
      linkHeader: '</llms.txt>; rel="describedby"',
    });
  });

  it.each(['--inject-script-file=/etc/passwd', 'file:///etc/passwd', 'not a url'])(
    'refuses %s without calling the renderer',
    async (url) => {
      const target = renderer('guarded');

      await expect(new RendererFetchAdapter(target).fetch(url)).rejects.toThrow('http or https');
      expect(target.render).not.toHaveBeenCalled();
    },
  );

  it('reports a page the renderer says was blocked', async () => {
    const adapter = new RendererFetchAdapter(renderer('lightpanda', { html: '', blocked: 'cloudflare bot challenge' }));

    await expect(adapter.fetch('https://example.com/')).rejects.toThrow(
      'Rendering with lightpanda was blocked: cloudflare bot challenge',
    );
  });

  it('names the renderer when it fails', async () => {
    const adapter = new RendererFetchAdapter({
      id: 'obscura',
      render: async () => {
        throw new Error('CouldntResolveHost');
      },
    });

    await expect(adapter.fetch('https://example.com/')).rejects.toThrow(
      'Rendering with obscura failed: CouldntResolveHost',
    );
  });

  it.each([
    ['nothing', undefined],
    ['an empty page', { html: '  ' }],
    ['a result without HTML text', { html: 42 }],
  ])('fails when the renderer returns %s', async (_name, result) => {
    const adapter = new RendererFetchAdapter({ id: 'broken', render: async () => result as unknown as RenderResult });

    await expect(adapter.fetch('https://example.com/')).rejects.toThrow(
      'Rendering with broken failed: the renderer returned no HTML',
    );
  });
});
