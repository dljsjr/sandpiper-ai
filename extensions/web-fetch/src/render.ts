/**
 * Rendered fetch: load a page in a headless browser, so the page's JavaScript runs.
 * Framework-independent — no pi imports.
 *
 * A renderer is code that drives one browser and returns a normalized result. Extensions
 * register renderers on WEB_FETCH_RENDERER_CHANNEL. web_fetch has none of its own.
 */

import { execFile } from 'node:child_process';
import { accessSync, constants, statSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { mediaType } from './media-types.js';
import type { FetchAdapter, FetchOptions, FetchResult } from './types.js';

/** Event bus channel on which extensions register a renderer, during `resources_discover`. */
export const WEB_FETCH_RENDERER_CHANNEL = 'sandpiper:web-fetch-renderer';
/** The value of the tool's renderer choice that means a plain fetch. Not available as a renderer id. */
export const NO_RENDERER = 'none';

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 20 * 1024 * 1024;

export interface RenderRequest {
  /** Normalized `http` or `https` URL. */
  readonly url: string;
  /** Time the renderer has to answer. */
  readonly timeoutMs: number;
}

export interface CommandResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export interface RenderTools {
  /**
   * Run a browser command and collect its output. The command starts directly from the argument
   * list, with no shell, and is stopped at the request's time limit or when the fetch is cancelled.
   * A non-zero exit is returned, not thrown, because browsers report failures in their output.
   */
  run(executable: string, args: readonly string[]): Promise<CommandResult>;
}

export interface RenderResult {
  /** The page's HTML after its scripts ran. */
  readonly html: string;
  /** Final URL after redirects. Defaults to the requested URL. */
  readonly url?: string;
  /** HTTP status of the page. Defaults to 200. */
  readonly statusCode?: number;
  /** Content-Type of the page. Defaults to `text/html`. */
  readonly contentType?: string;
  /** Link header of the page, when the browser reports response headers. */
  readonly linkHeader?: string;
  /** Set when the site refused the browser, for example with a bot challenge. Names the cause. */
  readonly blocked?: string;
}

export interface WebFetchRenderer {
  readonly id: string;
  render(request: RenderRequest, tools: RenderTools): Promise<RenderResult>;
  /** Called once when web_fetch accepts the registration. */
  readonly acknowledge?: () => void;
}

function isExecutableFile(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** The absolute path of an executable: a name is looked up on the PATH value, a path is used as given. */
export function findExecutable(name: string, pathVariable: string | undefined): string | undefined {
  const candidates = name.includes('/')
    ? [resolve(name)]
    : (pathVariable ?? '')
        .split(delimiter)
        .filter(Boolean)
        .map((directory) => join(directory, name));

  return candidates.find(isExecutableFile);
}

export function runCommand(
  executable: string,
  args: readonly string[],
  options: { readonly timeoutMs: number; readonly signal?: AbortSignal },
): Promise<CommandResult> {
  return new Promise((resolveResult, reject) => {
    execFile(
      executable,
      [...args],
      { timeout: options.timeoutMs, maxBuffer: MAX_OUTPUT_BYTES, encoding: 'utf8', signal: options.signal },
      (error, stdout, stderr) => {
        if (!error) return resolveResult({ stdout, stderr, exitCode: 0 });
        if (options.signal?.aborted) return reject(options.signal.reason);
        if (error.killed) return reject(new Error(`no result after ${options.timeoutMs} ms`));
        if (typeof error.code === 'number') return resolveResult({ stdout, stderr, exitCode: error.code });

        reject(new Error(`could not start ${executable}: ${error.message}`));
      },
    );
  });
}

function isRenderer(value: unknown): value is WebFetchRenderer {
  if (typeof value !== 'object' || value === null) return false;

  const renderer = value as Partial<WebFetchRenderer>;
  return (
    typeof renderer.id === 'string' &&
    renderer.id.trim().length > 0 &&
    typeof renderer.render === 'function' &&
    (renderer.acknowledge === undefined || typeof renderer.acknowledge === 'function')
  );
}

/** Collects renderer registrations from the event bus. */
export class RendererCollector {
  readonly #registered = new Map<string, WebFetchRenderer>();

  /** Accept a registration. The first renderer registered under an id keeps it. */
  add(value: unknown): void {
    if (!isRenderer(value)) return;

    const id = value.id.trim();
    if (id.toLowerCase() === NO_RENDERER || this.#registered.has(id)) return;

    this.#registered.set(id, { ...value, id });
    value.acknowledge?.();
  }

  /** The registered renderers in id order, so the result does not depend on extension load order. */
  renderers(): readonly WebFetchRenderer[] {
    return [...this.#registered.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
}

/** The URL in normalized form. It always starts with its scheme, so a browser cannot read it as an option. */
function httpUrl(url: string): string {
  const parsed = URL.canParse(url) ? new URL(url) : undefined;
  if (parsed?.protocol !== 'http:' && parsed?.protocol !== 'https:') {
    throw new Error(`Rendering needs an http or https URL: ${url}`);
  }
  return parsed.toString();
}

/** Fetch adapter backed by a renderer. Checks what the renderer returns: it is code this extension does not own. */
export class RendererFetchAdapter implements FetchAdapter {
  private readonly timeoutMs: number;

  constructor(
    private readonly renderer: WebFetchRenderer,
    options: { readonly timeoutMs?: number } = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async fetch(url: string, options: FetchOptions = {}): Promise<FetchResult> {
    const target = httpUrl(url);
    const { id } = this.renderer;
    const timeoutMs = this.timeoutMs;
    const { signal } = options;

    let result: RenderResult | undefined;
    try {
      result = await this.renderer.render(
        { url: target, timeoutMs },
        { run: (executable, args) => runCommand(executable, args, { timeoutMs, signal }) },
      );
    } catch (error) {
      throw new Error(`Rendering with ${id} failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (result?.blocked) throw new Error(`Rendering with ${id} was blocked: ${result.blocked}`);
    if (typeof result?.html !== 'string' || result.html.trim() === '') {
      throw new Error(`Rendering with ${id} failed: the renderer returned no HTML`);
    }

    return {
      url: result.url ?? target,
      statusCode: result.statusCode ?? 200,
      body: result.html,
      contentType: mediaType(result.contentType) ?? 'text/html',
      ...(result.linkHeader ? { linkHeader: result.linkHeader } : {}),
    };
  }
}
