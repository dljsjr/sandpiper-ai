import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MAX_JSON_BYTES, tryConvertJsonToToon } from 'sandpiper-capability-autotoon';
import * as z from 'zod/v4';

const NOT_CONVERTED_REASON = 'Input was not converted by AutoTOON policy.';

export function createSandpiperClaudeMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: 'sandpiper-claude-mcp',
      version: '0.0.1',
    },
    {
      instructions:
        'Sandpiper neutral Claude Code tools. Use convert_json_to_toon when JSON text should be compacted for handoff or analysis.',
    },
  );

  server.registerTool(
    'convert_json_to_toon',
    {
      title: 'Convert JSON to TOON',
      description:
        'Convert JSON text to TOON when AutoTOON policy determines the result is valid and shorter than the input.',
      inputSchema: {
        json: z.string().describe('JSON text to convert.'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
      _meta: {
        'anthropic/maxResultSizeChars': MAX_JSON_BYTES,
      },
    },
    async ({ json }) => {
      const converted = tryConvertJsonToToon(json);

      if (converted === null) {
        return {
          content: [{ type: 'text' as const, text: NOT_CONVERTED_REASON }],
          structuredContent: {
            converted: false,
            reason: NOT_CONVERTED_REASON,
          },
        };
      }

      return {
        content: [{ type: 'text' as const, text: converted }],
        structuredContent: {
          converted: true,
          format: 'toon',
          text: converted,
        },
      };
    },
  );

  return server;
}
