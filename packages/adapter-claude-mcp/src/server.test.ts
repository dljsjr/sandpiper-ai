import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { createSandpiperClaudeMcpServer } from './server.js';

function longJsonFixture(): string {
  return JSON.stringify(
    Array.from({ length: 16 }, (_, index) => ({
      id: index,
      name: `fixture-${index}`,
      status: 'active',
      owner: 'sandpiper',
    })),
  );
}

describe('Sandpiper Claude MCP adapter', () => {
  it('registers an AutoTOON conversion tool with Claude result-size metadata', async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'sandpiper-claude-mcp-test', version: '0.0.1' });
    const server = createSandpiperClaudeMcpServer();

    try {
      await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

      const tools = await client.listTools();
      const tool = tools.tools.find((candidate) => candidate.name === 'convert_json_to_toon');

      expect(tool).toMatchObject({
        name: 'convert_json_to_toon',
        description: expect.stringContaining('Convert JSON text to TOON'),
        _meta: { 'anthropic/maxResultSizeChars': 100_000 },
      });
      expect(tool?.inputSchema.required).toEqual(['json']);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it('converts JSON through the host-neutral AutoTOON core', async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'sandpiper-claude-mcp-test', version: '0.0.1' });
    const server = createSandpiperClaudeMcpServer();

    try {
      await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

      const result = await client.callTool({
        name: 'convert_json_to_toon',
        arguments: { json: longJsonFixture() },
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({ converted: true, format: 'toon' });
      expect(result.content).toEqual([
        {
          type: 'text',
          text: expect.stringContaining('[TOON]\n'),
        },
      ]);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it('returns a structured non-conversion result without echoing invalid input', async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'sandpiper-claude-mcp-test', version: '0.0.1' });
    const server = createSandpiperClaudeMcpServer();

    try {
      await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

      const result = await client.callTool({
        name: 'convert_json_to_toon',
        arguments: { json: 'not json' },
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toEqual({
        converted: false,
        reason: 'Input was not converted by AutoTOON policy.',
      });
      expect(result.content).toEqual([
        {
          type: 'text',
          text: 'Input was not converted by AutoTOON policy.',
        },
      ]);
    } finally {
      await client.close();
      await server.close();
    }
  });
});
