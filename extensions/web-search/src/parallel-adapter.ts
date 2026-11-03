/**
 * Parallel Search MCP adapter — the no-key fallback provider.
 *
 * Hits Parallel's free, anonymous Search MCP server (https://search.parallel.ai/mcp)
 * over Streamable HTTP via Pi's standalone MCP client (no host configuration or
 * upstream tool registration). The MCP `web_search` tool returns LLM-optimized
 * excerpts; we map them to SearchResultItem[]. Free tier needs no API key.
 *
 * Parallel's web_search input (from the live tool schema): objective + search_queries[]
 * (+ optional stable session_id for free-tier rate limiting). Output: content[0].text is
 * a JSON string of { results: [{ url, title, excerpts: string[] }] }.
 */

import { McpClient, StreamableHttpTransport } from '@earendil-works/pi-mcp';
import {
  DEFAULT_RESULT_COUNT,
  MAX_RESULT_COUNT,
  type SearchAdapter,
  type SearchAdapterOptions,
  type SearchResultItem,
} from './types.js';

const PARALLEL_MCP_URL = 'https://search.parallel.ai/mcp';
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MCP_REQUEST_TIMEOUT_MS = 60_000;
const MAX_TIMER_DELAY_MS = 2_147_483_647;

/** Minimal shapes for what we read out of the MCP tool result. */
interface McpTextContent {
  readonly type?: string;
  readonly text?: string;
}
interface McpToolResult {
  readonly content?: McpTextContent[];
  readonly isError?: boolean;
}
interface ParallelResultRow {
  readonly url?: string;
  readonly title?: string;
  readonly excerpts?: string[];
}
interface ParallelSearchPayload {
  readonly results?: ParallelResultRow[];
}

/**
 * Parse an MCP web_search tool result into SearchResultItem[].
 * Exported for unit testing — this is the bug-prone mapping layer.
 */
export function parseParallelResult(raw: unknown, count: number): SearchResultItem[] {
  const result = raw as McpToolResult | undefined;
  const text = result?.content?.find((c) => c?.type === 'text' && typeof c.text === 'string')?.text;
  if (!text) return [];

  let payload: ParallelSearchPayload;
  try {
    payload = JSON.parse(text) as ParallelSearchPayload;
  } catch {
    return [];
  }

  const rows = payload.results ?? [];
  return rows
    .filter((r): r is ParallelResultRow & { url: string } => typeof r.url === 'string' && r.url.length > 0)
    .slice(0, count)
    .map((r) => ({
      title: (r.title ?? '').trim() || r.url,
      url: r.url,
      snippet: (r.excerpts?.[0] ?? '').trim(),
    }));
}

export class ParallelMcpSearchAdapter implements SearchAdapter {
  readonly name = 'parallel';

  // Stable per-instance id: Parallel uses it for free-tier rate limiting / call correlation.
  private readonly sessionId = `sp-${crypto.randomUUID()}`;

  async search(query: string, options?: SearchAdapterOptions): Promise<SearchResultItem[]> {
    const trimmed = query.trim();
    if (trimmed === '') {
      return [];
    }
    const count = Math.min(options?.count ?? DEFAULT_RESULT_COUNT, MAX_RESULT_COUNT);
    const requestedTimeoutMs = Math.trunc(options?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const timeoutMs =
      Number.isFinite(requestedTimeoutMs) && requestedTimeoutMs > 0
        ? Math.min(requestedTimeoutMs, MAX_TIMER_DELAY_MS)
        : DEFAULT_MCP_REQUEST_TIMEOUT_MS;

    const client = new McpClient({
      name: 'sandpiper-web-search',
      version: '0.0.1',
      requestTimeoutMs: DEFAULT_MCP_REQUEST_TIMEOUT_MS,
    });
    let closePromise: Promise<void> | undefined;
    const closeClient = () => (closePromise ??= client.close().catch(() => {}));
    let connectionTimeoutError: Error | undefined;
    // The client's request timer does not cover the initialized-notification POST.
    const connectionTimer = setTimeout(() => {
      connectionTimeoutError = new Error(`Parallel MCP connection timed out after ${DEFAULT_MCP_REQUEST_TIMEOUT_MS}ms`);
      void closeClient();
    }, DEFAULT_MCP_REQUEST_TIMEOUT_MS);

    try {
      await client.connect(new StreamableHttpTransport({ url: PARALLEL_MCP_URL }));
      clearTimeout(connectionTimer);
      const raw = await client.callTool(
        'web_search',
        { objective: trimmed, search_queries: [trimmed], session_id: this.sessionId },
        { timeoutMs },
      );
      return parseParallelResult(raw, count);
    } catch (error) {
      throw connectionTimeoutError ?? error;
    } finally {
      clearTimeout(connectionTimer);
      await closeClient();
    }
  }
}
