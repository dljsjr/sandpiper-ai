import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RENDER_COMMAND_ENV, RenderingFetchAdapter, resolveRenderCommand } from './render.js';

let dir: string;

function script(name: string, body: string, mode = 0o755): string {
  const path = join(dir, name);
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, mode);
  return path;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sp-render-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('resolveRenderCommand', () => {
  it('uses Lightpanda by default when it is on PATH', () => {
    const lightpanda = script('lightpanda', 'exit 0');

    const command = resolveRenderCommand({ PATH: dir });

    expect(command?.executable).toBe(lightpanda);
    expect(command?.args).toContain('{url}');
    expect(command?.args.slice(0, 3)).toEqual(['fetch', '--dump', 'html']);
  });

  it('returns nothing when no browser is available', () => {
    expect(resolveRenderCommand({ PATH: dir })).toBeUndefined();
  });

  it('ignores a file on PATH that is not executable', () => {
    script('lightpanda', 'exit 0', 0o644);

    expect(resolveRenderCommand({ PATH: dir })).toBeUndefined();
  });

  it('takes another browser command from the environment', () => {
    const obscura = script('obscura', 'exit 0');

    const command = resolveRenderCommand({
      PATH: dir,
      [RENDER_COMMAND_ENV]: '  obscura fetch --dump html   --quiet {url} ',
    });

    expect(command).toEqual({ executable: obscura, args: ['fetch', '--dump', 'html', '--quiet', '{url}'] });
  });

  it('puts the URL last when the command has no placeholder', () => {
    const browser = script('browser', 'exit 0');

    expect(resolveRenderCommand({ PATH: '', [RENDER_COMMAND_ENV]: `${browser} --html` })).toEqual({
      executable: browser,
      args: ['--html', '{url}'],
    });
  });

  it('returns nothing when the configured browser does not exist, without falling back', () => {
    script('lightpanda', 'exit 0');

    expect(resolveRenderCommand({ PATH: dir, [RENDER_COMMAND_ENV]: 'no-such-browser {url}' })).toBeUndefined();
  });
});

describe('RenderingFetchAdapter', () => {
  it('returns the HTML the browser prints', async () => {
    const browser = script('browser', 'printf "<html><body><h1>Rendered</h1></body></html>"');
    const adapter = new RenderingFetchAdapter({ executable: browser, args: ['{url}'] });

    expect(await adapter.fetch('https://example.com/page')).toEqual({
      url: 'https://example.com/page',
      statusCode: 200,
      body: '<html><body><h1>Rendered</h1></body></html>',
      contentType: 'text/html',
    });
  });

  it('passes the URL as one argument that no shell reads', async () => {
    const marker = join(dir, 'marker');
    const browser = script('browser', 'printf "%s|%s" "$#" "$2"');
    const adapter = new RenderingFetchAdapter({ executable: browser, args: ['--flag', '--url={url}'] });

    const url = `https://example.com/search?q=one&page=2&x=$(touch%20${marker});\`id\``;

    const result = await adapter.fetch(url);

    expect(result.body).toBe(`2|--url=${new URL(url).toString()}`);
    expect(result.body).toContain('q=one&page=2&x=$(touch');
    expect(existsSync(marker)).toBe(false);
  });

  it.each(['--inject-script-file=/etc/passwd', 'file:///etc/passwd', 'not a url'])(
    'refuses %s without starting the browser',
    async (url) => {
      const marker = join(dir, 'ran');
      const browser = script('browser', `touch ${marker}; printf "<html></html>"`);
      const adapter = new RenderingFetchAdapter({ executable: browser, args: ['{url}'] });

      await expect(adapter.fetch(url)).rejects.toThrow('http or https');
      expect(existsSync(marker)).toBe(false);
    },
  );

  it('reports the exit code and the end of what the browser wrote to stderr when it fails', async () => {
    const browser = script('browser', 'echo "page failed err=BotChallenge" >&2; echo "navigation done" >&2; exit 3');
    const adapter = new RenderingFetchAdapter({ executable: browser, args: ['{url}'] });

    await expect(adapter.fetch('https://example.com/')).rejects.toThrow(
      'Rendering failed (exit 3): page failed err=BotChallenge\nnavigation done',
    );
  });

  it('starts a long error report at a whole line', async () => {
    const browser = script(
      'browser',
      'i=0; while [ $i -lt 40 ]; do echo "noise line $i with padding to make it long enough" >&2; i=$((i+1)); done; echo "final cause" >&2; exit 1',
    );
    const adapter = new RenderingFetchAdapter({ executable: browser, args: ['{url}'] });

    const error = await adapter.fetch('https://example.com/').catch((caught: Error) => caught);

    expect((error as Error).message).toMatch(/^Rendering failed \(exit 1\): noise line \d+ with padding/);
    expect((error as Error).message.endsWith('final cause')).toBe(true);
  });

  it('fails when the browser prints nothing', async () => {
    const browser = script('browser', 'exit 0');
    const adapter = new RenderingFetchAdapter({ executable: browser, args: ['{url}'] });

    await expect(adapter.fetch('https://example.com/')).rejects.toThrow(
      'Rendering failed: the browser printed nothing',
    );
  });

  it('stops a browser that runs past the time limit', async () => {
    const browser = script('browser', 'exec sleep 10');
    const adapter = new RenderingFetchAdapter({ executable: browser, args: ['{url}'] }, { timeoutMs: 200 });
    const started = Date.now();

    await expect(adapter.fetch('https://example.com/')).rejects.toThrow('Rendering failed: no result after 200 ms');
    expect(Date.now() - started).toBeLessThan(5_000);
  });
});
