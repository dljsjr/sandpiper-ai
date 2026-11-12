/**
 * Built-in renderer for the Lightpanda headless browser (https://lightpanda.io).
 * Framework-independent — no pi imports.
 */

import { findExecutable, type RenderResult, type WebFetchRenderer } from './render.js';

// Content loaded by script is usually present once the network goes quiet.
const MAX_SETTLE_MS = 8_000;
// Leave time to start the browser and read its output inside the request's limit.
const HEADROOM_MS = 5_000;
const STDERR_TAIL_CHARACTERS = 300;

interface LightpandaReport {
  readonly url?: string;
  readonly status?: number;
  readonly headers: readonly { readonly name: string; readonly value: string }[];
  readonly content: string;
  readonly error?: string;
  readonly botChallenge?: string;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/** Read the object `lightpanda fetch --json` prints. Returns nothing when the output is something else. */
function parseReport(stdout: string): LightpandaReport | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return undefined;
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined;

  const report = parsed as Record<string, unknown>;
  const headers = Array.isArray(report.headers) ? report.headers : [];
  return {
    url: text(report.url),
    status: typeof report.http_status === 'number' && report.http_status > 0 ? report.http_status : undefined,
    headers: headers.flatMap((header: unknown) => {
      const { name, value } = (header ?? {}) as Record<string, unknown>;
      return typeof name === 'string' && typeof value === 'string' ? [{ name: name.toLowerCase(), value }] : [];
    }),
    content: text(report.content) ?? '',
    error: text(report.error),
    botChallenge: text(report.bot_challenge),
  };
}

function headerValue(report: LightpandaReport, name: string): string | undefined {
  const values = report.headers.filter((header) => header.name === name).map((header) => header.value);
  return values.length > 0 ? values.join(', ') : undefined;
}

/** The Lightpanda renderer, or nothing when `lightpanda` is not on PATH. */
export function createLightpandaRenderer(env: NodeJS.ProcessEnv): WebFetchRenderer | undefined {
  const executable = findExecutable('lightpanda', env.PATH);
  if (!executable) return undefined;

  return {
    id: 'lightpanda',
    async render(request, tools): Promise<RenderResult> {
      const stopAfterMs = Math.max(request.timeoutMs - HEADROOM_MS, 1_000);
      const { stdout, stderr, exitCode } = await tools.run(executable, [
        'fetch',
        '--dump',
        'html',
        '--json',
        '--wait-until',
        'networkidle',
        '--wait-ms',
        String(Math.min(MAX_SETTLE_MS, stopAfterMs)),
        '--terminate-ms',
        String(stopAfterMs),
        '--block-private-networks',
        request.url,
      ]);

      const report = parseReport(stdout);
      if (!report) {
        throw new Error(`lightpanda exited with ${exitCode}: ${stderr.trim().slice(-STDERR_TAIL_CHARACTERS)}`);
      }
      if (report.botChallenge) return { html: '', blocked: `${report.botChallenge} bot challenge` };
      if (report.error) throw new Error(report.error);

      const contentType = headerValue(report, 'content-type');
      const linkHeader = headerValue(report, 'link');
      return {
        html: report.content,
        ...(report.url ? { url: report.url } : {}),
        ...(report.status ? { statusCode: report.status } : {}),
        ...(contentType ? { contentType } : {}),
        ...(linkHeader ? { linkHeader } : {}),
      };
    },
  };
}
