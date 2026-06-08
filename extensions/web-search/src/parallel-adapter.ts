/**
 * Parallel Search MCP adapter — the no-key fallback provider.
 *
 * Hits Parallel's free, anonymous Search MCP server (https://search.parallel.ai/mcp)
 * over Streamable HTTP via the mcporter runtime library (programmatic server def — no
 * config.json, no CLI subprocess). The MCP `web_search` tool returns LLM-optimized
 * excerpts; we map them to SearchResultItem[]. Free tier needs no API key.
 *
 * Parallel's web_search input (from the live tool schema): objective + search_queries[]
 * (+ optional stable session_id for free-tier rate limiting). Output: content[0].text is
 * a JSON string of { results: [{ url, title, excerpts: string[] }] }.
 */

import { createRuntime, type Runtime, type ServerDefinition } from 'mcporter';
import {
  DEFAULT_RESULT_COUNT,
  MAX_RESULT_COUNT,
  type SearchAdapter,
  type SearchAdapterOptions,
  type SearchResultItem,
} from './types.js';

const PARALLEL_MCP_URL = 'https://search.parallel.ai/mcp';
const SERVER_NAME = 'parallel-search';
const DEFAULT_TIMEOUT_MS = 15_000;

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

    const serverDef: ServerDefinition = {
      name: SERVER_NAME,
      command: { kind: 'http', url: new URL(PARALLEL_MCP_URL) },
    };

    const runtime: Runtime = await createRuntime({
      servers: [serverDef],
      clientInfo: { name: 'sandpiper-web-search', version: '0.0.1' },
    });

    try {
      const raw = await runtime.callTool(SERVER_NAME, 'web_search', {
        args: {
          objective: trimmed,
          search_queries: [trimmed],
          session_id: this.sessionId,
        },
        timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      });
      return parseParallelResult(raw, count);
    } finally {
      await runtime.close().catch(() => {
        // best-effort cleanup; a failed close shouldn't mask a successful search
      });
    }
  }
}
