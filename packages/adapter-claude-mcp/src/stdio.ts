#!/usr/bin/env node

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createSandpiperClaudeMcpServer } from './server.js';

export async function runStdioServer(): Promise<void> {
  const server = createSandpiperClaudeMcpServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error('Sandpiper Claude MCP server running on stdio');
}

const entrypoint = process.argv[1] === undefined ? undefined : resolve(process.argv[1]);

if (entrypoint === fileURLToPath(import.meta.url)) {
  await runStdioServer();
}
