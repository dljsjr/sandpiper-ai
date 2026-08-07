/**
 * Pi extension entry point for web-search.
 * Thin glue layer — delegates all logic to framework-independent modules.
 * Mirrors the web-fetch extension's structure and adapter-injection pattern.
 */

import { Type } from '@earendil-works/pi-ai';
import type { AgentToolResult, ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { selectSearchAdapter } from './adapter-selection.js';
import {
  PARAM_COUNT_DESC,
  PARAM_QUERY_DESC,
  TOOL_DESCRIPTION,
  TOOL_LABEL,
  TOOL_NAME,
  TOOL_PROMPT_GUIDELINES,
  TOOL_PROMPT_SNIPPET,
} from './tool-metadata.js';
import { executeWebSearchTool as defaultExecuteWebSearchTool, type WebSearchToolDetails } from './tool-operation.js';
import { MAX_RESULT_COUNT, type SearchAdapter } from './types.js';

interface WebSearchExtensionDependencies {
  /** Override the search provider. Defaults to Brave when a key resolves, else the no-key fallback. */
  readonly adapter?: SearchAdapter;
  readonly executeWebSearchTool?: typeof defaultExecuteWebSearchTool;
}

export default async function init(pi: ExtensionAPI, dependencies: WebSearchExtensionDependencies = {}) {
  const adapter = selectSearchAdapter(dependencies.adapter);
  const executeWebSearchTool = dependencies.executeWebSearchTool ?? defaultExecuteWebSearchTool;

  pi.registerTool({
    name: TOOL_NAME,
    label: TOOL_LABEL,
    description: TOOL_DESCRIPTION,
    promptSnippet: TOOL_PROMPT_SNIPPET,
    promptGuidelines: TOOL_PROMPT_GUIDELINES,
    parameters: Type.Object({
      query: Type.String({ description: PARAM_QUERY_DESC }),
      count: Type.Optional(Type.Integer({ description: PARAM_COUNT_DESC, minimum: 1, maximum: MAX_RESULT_COUNT })),
    }),
    async execute(_toolCallId, params): Promise<AgentToolResult<WebSearchToolDetails>> {
      const count = params.count === undefined ? undefined : Math.min(params.count, MAX_RESULT_COUNT);
      return executeWebSearchTool(adapter, { query: params.query, count });
    },
  });
}
