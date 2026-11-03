import { afterEach, describe, expect, it, vi } from 'vitest';
import { ParallelMcpSearchAdapter } from './parallel-adapter.js';

interface RpcRequest {
  readonly id?: number;
  readonly method: string;
  readonly params?: Record<string, unknown>;
}

type McpReply = (
  request: RpcRequest,
  signal: AbortSignal | null | undefined,
) => Response | Promise<Response> | undefined;

function useMcpServer(reply?: McpReply) {
  const requests: RpcRequest[] = [];
  const methods: string[] = [];
  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    expect(String(input)).toBe('https://search.parallel.ai/mcp');
    methods.push(init?.method ?? 'GET');
    if (init?.method === 'DELETE') return new Response(null, { status: 204 });
    if ((init?.method ?? 'GET') === 'GET') return new Response(null, { status: 405 });
    const request = JSON.parse(String(init?.body)) as RpcRequest;
    requests.push(request);
    const response = reply?.(request, init?.signal);
    if (response) return response;
    if (['notifications/initialized', 'notifications/cancelled'].includes(request.method)) {
      return new Response(null, { status: 202 });
    }
    expect(['initialize', 'tools/call']).toContain(request.method);
    const result =
      request.method === 'initialize'
        ? { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'fixture', version: '1' } }
        : {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  results: [{ url: 'https://example.invalid/', title: ' Result ', excerpts: [' Snippet '] }],
                }),
              },
            ],
          };
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }), {
      headers: { 'content-type': 'application/json', 'mcp-session-id': 'fixture-session' },
    });
  });
  return { requests, methods };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Parallel native MCP transport', () => {
  it('preserves the one-minute initialization budget and closes a stalled request', async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | null | undefined;
    let release: (() => void) | undefined;
    useMcpServer((request, signal) => {
      if (request.method !== 'initialize') return;
      requestSignal = signal;
      return new Promise((_resolve, reject) => {
        release = () => reject(new Error('Fixture released'));
        signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    });
    let error: unknown;
    const search = new ParallelMcpSearchAdapter().search('fixture query').catch((caught: unknown) => {
      error = caught;
    });
    try {
      await vi.advanceTimersByTimeAsync(30_000);
      expect(error).toBeUndefined();
      await vi.advanceTimersByTimeAsync(30_000);
      await search;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(/timed out/i);
      expect(requestSignal?.aborted).toBe(true);
    } finally {
      release?.();
      await search;
    }
  });

  it('bounds a stalled initialized notification and terminates its session', async () => {
    vi.useFakeTimers();
    let notificationSignal: AbortSignal | null | undefined;
    let release: (() => void) | undefined;
    const server = useMcpServer((request, signal) => {
      if (request.method !== 'notifications/initialized') return;
      notificationSignal = signal;
      return new Promise((resolve, reject) => {
        release = () => resolve(new Response(null, { status: 202 }));
        signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    });
    let error: unknown;
    const search = new ParallelMcpSearchAdapter().search('fixture query').catch((caught: unknown) => {
      error = caught;
    });
    try {
      await vi.advanceTimersByTimeAsync(60_000);
      expect(error).toBeInstanceOf(Error);
      await search;
      expect((error as Error).message).toMatch(/timed out/i);
      expect(notificationSignal?.aborted).toBe(true);
      expect(server.methods.filter((method) => method === 'DELETE')).toHaveLength(1);
    } finally {
      release?.();
      await search;
    }
  });

  it.each([
    [undefined, 15_000],
    [250, 250],
    [0, 60_000],
    [-1, 60_000],
    [0.5, 60_000],
    [Number.NaN, 60_000],
    [Number.POSITIVE_INFINITY, 60_000],
    [2_147_483_648, 2_147_483_647],
  ] as const)('enforces the tool-call deadline (%s) and aborts transport I/O on close', async (timeoutMs, deadline) => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | null | undefined;
    let release: (() => void) | undefined;
    let notifyCall: (() => void) | undefined;
    const called = new Promise<void>((resolve) => {
      notifyCall = resolve;
    });
    const server = useMcpServer((request, signal) => {
      if (request.method !== 'tools/call') return;
      requestSignal = signal;
      notifyCall?.();
      return new Promise((_resolve, reject) => {
        release = () => reject(new Error('Fixture released'));
        signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    });
    let error: unknown;
    const search = new ParallelMcpSearchAdapter().search('fixture query', { timeoutMs }).catch((caught: unknown) => {
      error = caught;
    });
    try {
      await called;
      await vi.advanceTimersByTimeAsync(deadline - 1);
      expect(error).toBeUndefined();
      await vi.advanceTimersByTimeAsync(1);
      expect(error).toBeInstanceOf(Error);
      await search;
      expect((error as Error).message).toMatch(/timed out/i);
      expect(requestSignal?.aborted).toBe(true);
      expect(server.requests.some((request) => request.method === 'notifications/cancelled')).toBe(true);
      expect(server.methods.filter((method) => method === 'DELETE')).toHaveLength(1);
    } finally {
      release?.();
      await search;
    }
  });

  it('keeps the application session id across fresh per-search connections', async () => {
    const server = useMcpServer();
    const adapter = new ParallelMcpSearchAdapter();

    await adapter.search('first query');
    await adapter.search('second query');

    const calls = server.requests.filter((request) => request.method === 'tools/call');
    const args = calls.map((request) => request.params?.arguments as Record<string, unknown>);
    expect(args[0]?.session_id).toMatch(/^sp-/);
    expect(args[1]?.session_id).toBe(args[0]?.session_id);
    expect(args.map((item) => item.search_queries)).toEqual([['first query'], ['second query']]);
    expect(server.requests.filter((request) => request.method === 'initialize')).toHaveLength(2);
    expect(server.methods.filter((method) => method === 'DELETE')).toHaveLength(2);
  });

  it.each([
    [undefined, 5],
    [99, 20],
  ] as const)('applies the local result limit (%s)', async (count, expected) => {
    useMcpServer((request) => {
      if (request.method !== 'tools/call') return;
      const results = Array.from({ length: 25 }, (_, index) => ({ url: `https://example.invalid/${index}` }));
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: request.id,
          result: {
            content: [{ type: 'text', text: JSON.stringify({ results }) }],
          },
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    });

    expect(await new ParallelMcpSearchAdapter().search('fixture query', { count })).toHaveLength(expected);
  });

  it('preserves protocol failures and still terminates the session', async () => {
    const server = useMcpServer((request) => {
      if (request.method !== 'tools/call') return;
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32602,
            message: 'Fixture protocol failure',
          },
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    });

    await expect(new ParallelMcpSearchAdapter().search('fixture query')).rejects.toThrow('Fixture protocol failure');

    expect(server.methods.filter((method) => method === 'DELETE')).toHaveLength(1);
  });

  it('does not replace a successful search with a cleanup failure', async () => {
    useMcpServer();
    const fetch = globalThis.fetch;
    let cleanupAttempts = 0;
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      if (init?.method === 'DELETE') {
        cleanupAttempts++;
        throw new Error('Fixture cleanup failure');
      }
      return fetch(input, init);
    });

    const result = await new ParallelMcpSearchAdapter().search('fixture query');

    expect(result).toEqual([{ title: 'Result', url: 'https://example.invalid/', snippet: 'Snippet' }]);
    expect(cleanupAttempts).toBe(1);
  });

  it('waits for session cleanup already started by the connection deadline', async () => {
    vi.useFakeTimers();
    let releaseNotification: (() => void) | undefined;
    useMcpServer((request, signal) => {
      if (request.method !== 'notifications/initialized') return;
      return new Promise((resolve, reject) => {
        releaseNotification = () => resolve(new Response(null, { status: 202 }));
        signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    });
    const fetch = globalThis.fetch;
    let finishDelete: (() => void) | undefined;
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      if (init?.method === 'DELETE') {
        return new Promise((resolve) => {
          finishDelete = () => resolve(new Response(null, { status: 204 }));
        });
      }
      return fetch(input, init);
    });
    let error: unknown;
    let settled = false;
    const search = new ParallelMcpSearchAdapter()
      .search('fixture query')
      .catch((caught: unknown) => {
        error = caught;
      })
      .finally(() => {
        settled = true;
      });
    try {
      await vi.advanceTimersByTimeAsync(60_000);
      expect(finishDelete).toBeTypeOf('function');
      expect(settled).toBe(false);
      finishDelete?.();
      await search;
      expect((error as Error).message).toMatch(/timed out/i);
      expect(settled).toBe(true);
    } finally {
      releaseNotification?.();
      finishDelete?.();
      await search;
    }
  });

  it('does not connect for an empty query', async () => {
    const server = useMcpServer();

    expect(await new ParallelMcpSearchAdapter().search('  ')).toEqual([]);

    expect(server.methods).toEqual([]);
  });

  it('returns search rows through the native client without exposing upstream tools', async () => {
    const server = useMcpServer();

    const result = await new ParallelMcpSearchAdapter().search('  fixture query  ', { count: 1 });

    expect(result).toEqual([{ title: 'Result', url: 'https://example.invalid/', snippet: 'Snippet' }]);
    expect(server.requests.find((request) => request.method === 'initialize')?.params?.clientInfo).toEqual({
      name: 'sandpiper-web-search',
      version: '0.0.1',
    });
    expect(server.requests.find((request) => request.method === 'tools/call')?.params).toEqual({
      name: 'web_search',
      arguments: {
        objective: 'fixture query',
        search_queries: ['fixture query'],
        session_id: expect.stringMatching(/^sp-/),
      },
    });
    expect(server.requests.some((request) => request.method === 'tools/list')).toBe(false);
    expect(server.methods.filter((method) => method === 'DELETE')).toHaveLength(1);
  });
});
