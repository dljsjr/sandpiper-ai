// Loaded only by the packed CLI test. Never delegates to the real network.
import { writeFileSync } from 'node:fs';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

interface RpcRequest {
  readonly id?: number;
  readonly method: string;
  readonly params?: Record<string, unknown>;
}

export default function (pi: ExtensionAPI): void {
  const requests: { method: string; rpc?: RpcRequest; session: string | null }[] = [];
  const blocked: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url !== 'https://search.parallel.ai/mcp') {
      blocked.push(url);
      throw new Error(`Unexpected packed-probe network request: ${url}`);
    }
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (headers.has('authorization')) throw new Error('Anonymous MCP request carried authorization');
    const rpc = method === 'POST' ? (JSON.parse(String(init?.body)) as RpcRequest) : undefined;
    requests.push({ method, rpc, session: headers.get('mcp-session-id') });
    if (method === 'GET') return new Response(null, { status: 405 });
    if (method === 'DELETE') return new Response(null, { status: 204 });
    if (rpc?.method === 'notifications/initialized') return new Response(null, { status: 202 });
    if (rpc?.method !== 'initialize' && rpc?.method !== 'tools/call') {
      throw new Error(`Unexpected MCP method: ${rpc?.method}`);
    }
    const result =
      rpc.method === 'initialize'
        ? {
            protocolVersion: '2025-03-26',
            capabilities: { tools: {} },
            serverInfo: { name: 'packed-native-fixture', version: '1' },
          }
        : {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  results: [
                    { url: 'https://example.invalid/packed', title: ' Packed title ', excerpts: [' Packed snippet '] },
                    { url: 'https://example.invalid/omitted', title: 'Omitted by count', excerpts: ['Not returned'] },
                  ],
                }),
              },
            ],
          };
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result }), {
      headers: { 'content-type': 'application/json', 'mcp-session-id': 'packed-native-session' },
    });
  };

  pi.on('session_shutdown', async () => {
    const proofPath = process.env.SANDPIPER_PACKED_MCP_PROOF;
    if (!proofPath) throw new Error('Missing packed MCP proof path');
    writeFileSync(
      proofPath,
      JSON.stringify({
        requests,
        blocked,
        tools: pi.getAllTools().map(({ name, parameters, namespace, sourceInfo }) => ({
          name,
          parameters,
          namespace,
          sourceInfo,
        })),
        activeTools: pi.getActiveTools(),
      }),
    );
  });
}
