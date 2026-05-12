/**
 * Passive llms.txt existence probing.
 * Framework-independent — no pi imports.
 */

import type { LlmsTxtProbeResult } from './types.js';

const DEFAULT_PROBE_TIMEOUT_MS = 3_000;
const probeCache = new Map<string, LlmsTxtProbeResult>();

export interface LlmsTxtProbeOptions {
  readonly timeoutMs?: number;
  readonly now?: () => Date;
}

interface ProbeTarget {
  readonly cacheKey: string;
  readonly url: string;
}

function checkedAt(options: LlmsTxtProbeOptions): string {
  return (options.now?.() ?? new Date()).toISOString();
}

function probeTarget(pageUrl: string): ProbeTarget {
  const parsed = new URL(pageUrl);

  // URL.origin includes scheme, host, and port. Keeping the scheme in the key
  // follows HTTP cache/origin semantics rather than guessing that http and https
  // have equivalent root metadata.
  return {
    cacheKey: parsed.origin,
    url: new URL('/llms.txt', parsed.origin).toString(),
  };
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

function resultFromResponse(response: Response, target: ProbeTarget, options: LlmsTxtProbeOptions): LlmsTxtProbeResult {
  if (response.status >= 200 && response.status < 300) {
    return {
      checked: true,
      exists: true,
      status: 'found',
      url: target.url,
      checkedAt: checkedAt(options),
      statusCode: response.status,
    };
  }

  if (response.status === 404 || response.status === 410) {
    return {
      checked: true,
      exists: false,
      status: 'missing',
      url: target.url,
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
      url: target.url,
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
    url: target.url,
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

export async function probeLlmsTxt(pageUrl: string, options: LlmsTxtProbeOptions = {}): Promise<LlmsTxtProbeResult> {
  let target: ProbeTarget;
  try {
    target = probeTarget(pageUrl);
  } catch (error) {
    return unknownResult(pageUrl, `invalid-url: ${errorReason(error)}`, options);
  }

  const cached = probeCache.get(target.cacheKey);
  if (cached !== undefined) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS);

  try {
    const response = await globalThis.fetch(target.url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
    });
    const result = resultFromResponse(response, target, options);
    probeCache.set(target.cacheKey, result);
    return result;
  } catch (error) {
    const result = unknownResult(target.url, errorReason(error), options);
    probeCache.set(target.cacheKey, result);
    return result;
  } finally {
    clearTimeout(timer);
  }
}
