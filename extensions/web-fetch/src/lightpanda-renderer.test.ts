import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLightpandaRenderer } from './lightpanda-renderer.js';
import type { CommandResult, RenderTools } from './render.js';

let dir: string;

/** Put a `lightpanda` file on PATH, so the renderer counts as installed. The tests never start it. */
function installLightpanda(): string {
  const path = join(dir, 'lightpanda');
  writeFileSync(path, '#!/bin/sh\nexit 1\n');
  chmodSync(path, 0o755);
  return path;
}

/** Tools whose `run` records each command and answers it with the given output. */
function answering(output: Partial<CommandResult>) {
  return { run: vi.fn<RenderTools['run']>(async () => ({ stdout: '', stderr: '', exitCode: 0, ...output })) };
}

/** Tools whose `run` answers with a Lightpanda report, as `lightpanda fetch --json` prints it. */
function reporting(report: unknown, exitCode = 0) {
  return answering({ stdout: JSON.stringify(report), exitCode });
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
    installLightpanda();
    const tools = reporting({
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
    const executable = installLightpanda();
    const tools = reporting({ url: 'https://example.com/', http_status: 200, headers: [], content: '<html></html>' });

    await createLightpandaRenderer({ PATH: dir })?.render({ url: 'https://example.com/', timeoutMs: 12_000 }, tools);

    expect(tools.run.mock.calls).toEqual([
      [
        executable,
        [
          'fetch',
          '--dump',
          'html',
          '--json',
          '--wait-until',
          'networkidle',
          '--wait-ms',
          '7000',
          '--terminate-ms',
          '7000',
          '--block-private-networks',
          'https://example.com/',
        ],
      ],
    ]);
  });

  it('reports a bot challenge as blocked', async () => {
    installLightpanda();
    const tools = reporting(
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
    installLightpanda();
    const tools = reporting(
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
    installLightpanda();
    const tools = answering({ stderr: 'unknown option --json\n', exitCode: 2 });

    await expect(
      createLightpandaRenderer({ PATH: dir })?.render({ url: 'https://example.com/', timeoutMs: 30_000 }, tools),
    ).rejects.toThrow('lightpanda exited with 2: unknown option --json');
  });

  it('fails when Lightpanda cannot start', async () => {
    const executable = installLightpanda();
    const tools = { run: vi.fn<RenderTools['run']>().mockRejectedValue(new Error(`could not start ${executable}`)) };

    await expect(
      createLightpandaRenderer({ PATH: dir })?.render({ url: 'https://example.com/', timeoutMs: 30_000 }, tools),
    ).rejects.toThrow(`could not start ${executable}`);
  });
});
