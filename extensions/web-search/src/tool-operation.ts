/**
 * Framework-independent execution + formatting for the web_search tool.
 * No pi SDK imports here — keeps the operation layer unit-testable without a session.
 * Mirrors web-fetch's tool-operation.ts shape.
 */

import type { SearchAdapter, SearchResultItem } from './types.js';

export interface WebSearchToolInput {
  readonly query: string;
  readonly count?: number;
}

// Mirrors Pi's text content item shape without importing Pi SDK types into the operation layer.
interface TextContent {
  readonly type: 'text';
  readonly text: string;
}

export interface WebSearchToolDetails extends Record<string, unknown> {
  readonly query: string;
  readonly provider: string;
  readonly resultCount: number;
  readonly error?: string;
}

export interface WebSearchToolResult {
  readonly content: TextContent[];
  readonly details: WebSearchToolDetails;
}

/** Render results as a compact, agent-friendly numbered list. */
export function formatSearchResults(query: string, provider: string, results: readonly SearchResultItem[]): string {
  if (results.length === 0) {
    return `No results for "${query}" (via ${provider}).`;
  }

  const body = results
    .map((r, i) => {
      const snippet = r.snippet.trim();
      const lines = [`${i + 1}. ${r.title}`, `   ${r.url}`];
      if (snippet) {
        lines.push(`   ${snippet}`);
      }
      return lines.join('\n');
    })
    .join('\n\n');

  return `Search results for "${query}" (via ${provider}):\n\n${body}`;
}

export async function executeWebSearchTool(
  adapter: SearchAdapter,
  input: WebSearchToolInput,
): Promise<WebSearchToolResult> {
  try {
    const results = await adapter.search(input.query, { count: input.count });
    return {
      content: [{ type: 'text', text: formatSearchResults(input.query, adapter.name, results) }],
      details: {
        query: input.query,
        provider: adapter.name,
        resultCount: results.length,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Search failed for "${input.query}": ${message}` }],
      details: { query: input.query, provider: adapter.name, resultCount: 0, error: message },
    };
  }
}
