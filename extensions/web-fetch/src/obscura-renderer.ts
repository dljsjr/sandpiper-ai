/**
 * Renderer for the Obscura headless browser.
 * Framework-independent — no pi imports.
 *
 * Obscura prints the rendered HTML and nothing about the response, so a result carries no final
 * URL, status or headers.
 */

import { findExecutable, type RenderResult, type WebFetchRenderer } from './render.js';

// Leave time to start the browser and read its output inside the request's limit.
const HEADROOM_MS = 5_000;
const STDERR_TAIL_CHARACTERS = 300;
// Obscura exits 0 on a Cloudflare challenge and prints the challenge page. This is the script
// object every such page defines.
const CLOUDFLARE_CHALLENGE_MARKER = '_cf_chl_opt';

/** The Obscura renderer, or nothing when `obscura` is not on PATH. */
export function createObscuraRenderer(env: NodeJS.ProcessEnv): WebFetchRenderer | undefined {
  const executable = findExecutable('obscura', env.PATH);
  if (!executable) return undefined;

  return {
    id: 'obscura',
    async render(request, tools): Promise<RenderResult> {
      const timeoutSeconds = Math.max(Math.floor((request.timeoutMs - HEADROOM_MS) / 1_000), 1);
      const { stdout, stderr, exitCode } = await tools.run(executable, [
        'fetch',
        '--dump',
        'html',
        '--quiet',
        '--wait-until',
        'networkidle',
        '--timeout',
        String(timeoutSeconds),
        request.url,
      ]);

      if (exitCode !== 0) {
        throw new Error(stderr.trim().slice(-STDERR_TAIL_CHARACTERS) || `obscura exited with ${exitCode}`);
      }
      if (stdout.includes(CLOUDFLARE_CHALLENGE_MARKER)) return { html: '', blocked: 'cloudflare bot challenge' };

      return { html: stdout };
    },
  };
}
