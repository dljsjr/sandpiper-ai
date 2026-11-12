import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLightpandaRenderer } from './lightpanda-renderer.js';
import { type RenderTools, runCommand } from './render.js';

let dir: string;
const tools: RenderTools = { run: (executable, args) => runCommand(executable, args, { timeoutMs: 5_000 }) };

/** A stand-in browser that prints a fixed report, and its arguments when asked. */
function fakeLightpanda(report: unknown, exitCode = 0): void {
  const path = join(dir, 'lightpanda');
  const json = JSON.stringify(report).replaceAll("'", "'\\''");
  writeFileSync(
    path,
    `#!/bin/sh\nprintf '%s' "$*" > "${join(dir, 'args')}"\nprintf '%s' '${json}'\nexit ${exitCode}\n`,
  );
  chmodSync(path, 0o755);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sp-lightpanda-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('createLightpandaRenderer', () => {
  it('is absent when Lightpanda is not installed', () => {
    expect(createLightpandaRenderer({ PATH: dir })).toBeUndefined();
  });

  it('returns the rendered page with its final URL, status and headers', async () => {
    fakeLightpanda({
      url: 'https://example.com/final',
      http_status: 200,
      headers: [
        { name: 'Content-Type', value: 'text/html; charset=utf-8' },
        { name: 'link', value: '</a.md>; rel="alternate"; type="text/markdown"' },
        { name: 'link', value: '</llms.txt>; rel="describedby"' },
      ],
      content: '<html><body><h1>Rendered</h1></body></html>',
      error: null,
      bot_challenge: null,
    });
    const renderer = createLightpandaRenderer({ PATH: dir });

    expect(renderer?.id).toBe('lightpanda');
    expect(await renderer?.render({ url: 'https://example.com/start', timeoutMs: 30_000 }, tools)).toEqual({
      html: '<html><body><h1>Rendered</h1></body></html>',
      url: 'https://example.com/final',
      statusCode: 200,
      contentType: 'text/html; charset=utf-8',
      linkHeader: '</a.md>; rel="alternate"; type="text/markdown", </llms.txt>; rel="describedby"',
    });
  });

  it('waits for the network to settle, blocks private networks and stops inside the time limit', async () => {
    fakeLightpanda({ url: 'https://example.com/', http_status: 200, headers: [], content: '<html></html>' });

    await createLightpandaRenderer({ PATH: dir })?.render({ url: 'https://example.com/', timeoutMs: 12_000 }, tools);

    expect(readFileSync(join(dir, 'args'), 'utf8')).toBe(
      'fetch --dump html --json --wait-until networkidle --wait-ms 7000 --terminate-ms 7000 --block-private-networks https://example.com/',
    );
  });

  it('reports a bot challenge as blocked', async () => {
    fakeLightpanda(
      {
        url: 'https://example.com/',
        http_status: 403,
        headers: [],
        content: '<html>challenge</html>',
        error: 'BotChallenge',
        bot_challenge: 'cloudflare',
      },
      1,
    );

    expect(
      await createLightpandaRenderer({ PATH: dir })?.render({ url: 'https://example.com/', timeoutMs: 30_000 }, tools),
    ).toEqual({ html: '', blocked: 'cloudflare bot challenge' });
  });

  it('fails with the error Lightpanda names', async () => {
    fakeLightpanda(
      { url: 'https://nonexistent.invalid/', http_status: 0, headers: [], content: '', error: 'CouldntResolveHost' },
      1,
    );

    await expect(
      createLightpandaRenderer({ PATH: dir })?.render(
        { url: 'https://nonexistent.invalid/', timeoutMs: 30_000 },
        tools,
      ),
    ).rejects.toThrow('CouldntResolveHost');
  });

  it('fails with the exit code when the output is not a report', async () => {
    const path = join(dir, 'lightpanda');
    writeFileSync(path, '#!/bin/sh\necho "unknown option --json" >&2\nexit 2\n');
    chmodSync(path, 0o755);

    await expect(
      createLightpandaRenderer({ PATH: dir })?.render({ url: 'https://example.com/', timeoutMs: 30_000 }, tools),
    ).rejects.toThrow('lightpanda exited with 2: unknown option --json');
  });
});
