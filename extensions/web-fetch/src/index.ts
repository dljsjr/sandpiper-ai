/**
 * Pi extension entry point for web-fetch.
 * Thin glue layer — delegates all logic to framework-independent modules.
 */

import type { AgentToolResult, ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from '@sinclair/typebox';
import { SimpleFetchAdapter } from './fetch.js';
import { executeWebFetchTool } from './tool-operation.js';

export default async function init(pi: ExtensionAPI) {
  const adapter = new SimpleFetchAdapter();

  pi.registerTool({
    name: 'web_fetch',
    label: 'Web Fetch',
    description:
      'Fetch a web page and return its content as clean markdown. ' +
      'Use this to read documentation, READMEs, API references, blog posts, ' +
      'package details, or any web page the user points you to. ' +
      'Returns structured metadata (title, excerpt, byline) plus the page ' +
      'content converted to token-efficient markdown.',
    parameters: Type.Object({
      url: Type.String({ description: 'The URL to fetch' }),
      followLinks: Type.Optional(
        Type.Boolean({
          description: 'If true, extract and return links found in the page content',
        }),
      ),
    }),
    async execute(_toolCallId, params): Promise<AgentToolResult<unknown>> {
      return executeWebFetchTool(adapter, params);
    },
  });
}
