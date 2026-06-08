/**
 * Tests for the Parallel MCP adapter's result parsing.
 * parseParallelResult is the bug-prone mapping layer (MCP content -> SearchResultItem[]);
 * the live mcporter/network call is covered by an e2e probe, not here.
 */

import { describe, expect, it } from 'vitest';
import { parseParallelResult } from './parallel-adapter.js';

/** Build an MCP tool result whose text content is the given Parallel payload JSON. */
function mcpResult(payload: unknown): unknown {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
}

describe('parseParallelResult', () => {
  it('maps results to {title, url, snippet:excerpts[0]}', () => {
    const raw = mcpResult({
      search_id: 'search_x',
      results: [
        { url: 'https://a.test/', title: 'Alpha', excerpts: ['first excerpt', 'second'] },
        { url: 'https://b.test/', title: 'Beta', excerpts: ['beta excerpt'] },
      ],
    });
    const items = parseParallelResult(raw, 5);
    expect(items).toEqual([
      { title: 'Alpha', url: 'https://a.test/', snippet: 'first excerpt' },
      { title: 'Beta', url: 'https://b.test/', snippet: 'beta excerpt' },
    ]);
  });

  it('respects the count cap', () => {
    const raw = mcpResult({
      results: [
        { url: 'https://1.test/', title: '1', excerpts: ['e'] },
        { url: 'https://2.test/', title: '2', excerpts: ['e'] },
        { url: 'https://3.test/', title: '3', excerpts: ['e'] },
      ],
    });
    expect(parseParallelResult(raw, 2)).toHaveLength(2);
  });

  it('drops rows without a url and falls back to url when title is missing', () => {
    const raw = mcpResult({
      results: [
        { title: 'no url', excerpts: ['x'] },
        { url: 'https://ok.test/', excerpts: ['y'] },
      ],
    });
    const items = parseParallelResult(raw, 5);
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ title: 'https://ok.test/', url: 'https://ok.test/', snippet: 'y' });
  });

  it('returns empty for missing text content', () => {
    expect(parseParallelResult({ content: [] }, 5)).toEqual([]);
    expect(parseParallelResult(undefined, 5)).toEqual([]);
  });

  it('returns empty for malformed JSON in the text content', () => {
    expect(parseParallelResult({ content: [{ type: 'text', text: 'not json' }] }, 5)).toEqual([]);
  });

  it('handles an empty results array', () => {
    expect(parseParallelResult(mcpResult({ results: [] }), 5)).toEqual([]);
  });
});
