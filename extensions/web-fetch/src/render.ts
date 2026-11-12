/**
 * Fetch adapter that loads a page in a headless browser, so the page's JavaScript runs.
 * Framework-independent — no pi imports.
 *
 * The browser is any command that takes a URL and prints the rendered HTML on stdout.
 * It is started directly with an argument list. No shell reads the URL.
 */

import { execFile } from 'node:child_process';
import { accessSync, constants, statSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import type { FetchAdapter, FetchResult } from './types.js';

export const RENDER_COMMAND_ENV = 'SANDPIPER_WEB_FETCH_RENDER_COMMAND';

const URL_PLACEHOLDER = '{url}';
// Wait for the network to go quiet, so content loaded by script is present. Stop a page that never settles.
const DEFAULT_RENDER_COMMAND =
  'lightpanda fetch --dump html --wait-until networkidle --wait-ms 8000 --terminate-ms 20000 --block-private-networks {url}';
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 20 * 1024 * 1024;
const STDERR_TAIL_CHARACTERS = 500;

export interface RenderCommand {
  /** Absolute path of the browser executable. */
  readonly executable: string;
  /** Arguments. `{url}` is replaced by the page URL. */
  readonly args: readonly string[];
}

export interface RenderingFetchAdapterOptions {
  readonly timeoutMs?: number;
}

function isExecutableFile(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function findExecutable(name: string, pathVariable: string | undefined): string | undefined {
  const candidates = name.includes('/')
    ? [resolve(name)]
    : (pathVariable ?? '')
        .split(delimiter)
        .filter(Boolean)
        .map((directory) => join(directory, name));

  return candidates.find(isExecutableFile);
}

/**
 * The browser command for this process: the one named in the environment, or Lightpanda.
 * Returns nothing when its executable is not installed.
 *
 * The command is split on whitespace. A command that needs an argument with a space in it
 * belongs in a wrapper script.
 */
export function resolveRenderCommand(env: NodeJS.ProcessEnv): RenderCommand | undefined {
  const [name, ...args] = (env[RENDER_COMMAND_ENV]?.trim() || DEFAULT_RENDER_COMMAND).split(/\s+/);
  if (!name) return undefined;

  const executable = findExecutable(name, env.PATH);
  if (!executable) return undefined;

  return { executable, args: args.some((arg) => arg.includes(URL_PLACEHOLDER)) ? args : [...args, URL_PLACEHOLDER] };
}

/** The URL in normalized form. It always starts with its scheme, so a browser cannot read it as an option. */
function httpUrl(url: string): string {
  const parsed = URL.canParse(url) ? new URL(url) : undefined;
  if (parsed?.protocol !== 'http:' && parsed?.protocol !== 'https:') {
    throw new Error(`Rendering needs an http or https URL: ${url}`);
  }
  return parsed.toString();
}

/** The end of the browser's error output, starting at a whole line. */
function stderrTail(stderr: string): string {
  const text = stderr.trim();
  if (text.length <= STDERR_TAIL_CHARACTERS) return text;

  const tail = text.slice(-STDERR_TAIL_CHARACTERS);
  return tail.slice(tail.indexOf('\n') + 1);
}

export class RenderingFetchAdapter implements FetchAdapter {
  private readonly timeoutMs: number;

  constructor(
    private readonly command: RenderCommand,
    options: RenderingFetchAdapterOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async fetch(url: string): Promise<FetchResult> {
    const target = httpUrl(url);
    const args = this.command.args.map((arg) => arg.replaceAll(URL_PLACEHOLDER, target));
    const body = await this.run(args);
    if (body.trim() === '') throw new Error('Rendering failed: the browser printed nothing');

    // The browser reports no status or headers. A rendered page is HTML.
    return { url: target, statusCode: 200, body, contentType: 'text/html' };
  }

  private run(args: readonly string[]): Promise<string> {
    return new Promise((resolveOutput, reject) => {
      execFile(
        this.command.executable,
        args,
        { timeout: this.timeoutMs, maxBuffer: MAX_OUTPUT_BYTES, encoding: 'utf8' },
        (error, stdout, stderr) => {
          if (!error) return resolveOutput(stdout);
          if (error.killed) return reject(new Error(`Rendering failed: no result after ${this.timeoutMs} ms`));

          const detail = stderrTail(stderr) || error.message;
          reject(new Error(`Rendering failed (exit ${error.code ?? 'unknown'}): ${detail}`));
        },
      );
    });
  }
}
