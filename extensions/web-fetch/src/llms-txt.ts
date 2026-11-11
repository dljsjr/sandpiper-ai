/**
 * llms.txt discovery: find the index for language models that covers a page.
 * Framework-independent — no pi imports.
 */

import type { LlmsTxtProbeResult } from './types.js';

const DEFAULT_PROBE_TIMEOUT_MS = 3_000;
// An llms.txt covers the pages under its directory, so it sits near the top of a tree.
const MAX_CANDIDATES = 4;
// One answer per location for the life of the process, failures included: sites that
// resist automated requests are not asked again.
const probeCache = new Map<string, Promise<LlmsTxtProbeResult>>();

export interface LlmsTxtProbeOptions {
  readonly timeoutMs?: number;
  readonly now?: () => Date;
}

function checkedAt(options: LlmsTxtProbeOptions): string {
  return (options.now?.() ?? new Date()).toISOString();
}

/**
 * The llms.txt location of each directory above the page, most specific first.
 * A deep page keeps the root and the directories nearest to it.
 */
export function llmsTxtCandidates(pageUrl: string): readonly string[] {
  const page = new URL(pageUrl);
  const segments = page.pathname.split('/').slice(1, -1);
  const directories = ['/', ...segments.map((_, index) => `/${segments.slice(0, index + 1).join('/')}/`)];

  return directories
    .slice(0, MAX_CANDIDATES)
    .reverse()
    .map((directory) => new URL(`${directory}llms.txt`, page.origin).toString());
}

function unknownResult(url: string, reason: string, options: LlmsTxtProbeOptions): LlmsTxtProbeResult {
  return {
    checked: true,
    exists: null,
    status: 'unknown',
    url,
    checkedAt: checkedAt(options),
    reason,
  };
}

function resultFromResponse(response: Response, url: string, options: LlmsTxtProbeOptions): LlmsTxtProbeResult {
  if (response.status >= 200 && response.status < 300) {
    return {
      checked: true,
      exists: true,
      status: 'found',
      url,
      checkedAt: checkedAt(options),
      statusCode: response.status,
    };
  }

  if (response.status === 404 || response.status === 410) {
    return {
      checked: true,
      exists: false,
      status: 'missing',
      url,
      checkedAt: checkedAt(options),
      statusCode: response.status,
    };
  }

  if (response.status === 405) {
    const allow = response.headers.get('allow') ?? undefined;
    return {
      checked: true,
      exists: null,
      status: 'unknown',
      url,
      checkedAt: checkedAt(options),
      statusCode: response.status,
      reason: 'head-not-allowed',
      ...(allow === undefined ? {} : { allow }),
    };
  }

  return {
    checked: true,
    exists: null,
    status: 'unknown',
    url,
    checkedAt: checkedAt(options),
    statusCode: response.status,
    reason: 'unexpected-status',
  };
}

function errorReason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function clearLlmsTxtProbeCache(): void {
  probeCache.clear();
}

async function probe(url: string, options: LlmsTxtProbeOptions): Promise<LlmsTxtProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS);

  try {
    const response = await globalThis.fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    return resultFromResponse(response, url, options);
  } catch (error) {
    return unknownResult(url, errorReason(error), options);
  } finally {
    clearTimeout(timer);
  }
}

function cachedProbe(url: string, options: LlmsTxtProbeOptions): Promise<LlmsTxtProbeResult> {
  const cached = probeCache.get(url);
  if (cached !== undefined) return cached;

  const pending = probe(url, options);
  probeCache.set(url, pending);
  return pending;
}

/** A file the page itself named as its llms.txt. Taken as found without a request. */
export function declaredLlmsTxt(url: string, options: LlmsTxtProbeOptions = {}): LlmsTxtProbeResult {
  return { checked: false, exists: true, status: 'found', url, checkedAt: checkedAt(options) };
}

/**
 * Probe every candidate location at once and return the most specific file found.
 * When none is found, the result describes the site root.
 */
export async function discoverLlmsTxt(pageUrl: string, options: LlmsTxtProbeOptions = {}): Promise<LlmsTxtProbeResult> {
  let candidates: readonly string[];
  try {
    candidates = llmsTxtCandidates(pageUrl);
  } catch (error) {
    return unknownResult(pageUrl, `invalid-url: ${errorReason(error)}`, options);
  }

  const results = await Promise.all(candidates.map((candidate) => cachedProbe(candidate, options)));
  return (
    results.find((result) => result.exists === true) ??
    results.at(-1) ??
    unknownResult(pageUrl, 'no-candidates', options)
  );
}
