/**
 * Pi extension entry point for web-fetch.
 * Thin glue layer — delegates all logic to framework-independent modules.
 */

import type { AgentToolResult, ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from '@sinclair/typebox';
import { SystemNotificationSourceType, sendSystemNotification } from 'sandpiper-ai-core';
import { SimpleFetchAdapter } from './fetch.js';
import {
  executeWebFetchTool as defaultExecuteWebFetchTool,
  type WebFetchToolDetails,
  type WebFetchToolResult,
} from './tool-operation.js';
import { renderWebFetchCall, renderWebFetchResult } from './tool-rendering.js';
import { type FetchAdapter, WebFetchFilterType } from './types.js';

interface WebFetchExtensionDependencies {
  readonly adapter?: FetchAdapter;
  readonly executeWebFetchTool?: typeof defaultExecuteWebFetchTool;
}

export default async function init(pi: ExtensionAPI, dependencies: WebFetchExtensionDependencies = {}) {
  const adapter = dependencies.adapter ?? new SimpleFetchAdapter();
  const executeWebFetchTool = dependencies.executeWebFetchTool ?? defaultExecuteWebFetchTool;

  pi.registerTool({
    name: 'web_fetch',
    label: 'Web Fetch',
    description:
      'Fetch a web page and return its content as clean markdown. ' +
      'Use this to read documentation, READMEs, API references, blog posts, ' +
      'package details, or any web page the user points you to. ' +
      'Optionally target part of a page with a filter. ' +
      'Returns structured metadata (title, excerpt, byline) plus the page ' +
      'content converted to token-efficient markdown.',
    promptSnippet: 'Fetch a web page and return clean markdown content',
    parameters: Type.Object({
      url: Type.String({ description: 'The URL to fetch' }),
      followLinks: Type.Optional(
        Type.Boolean({
          description: 'If true, extract and return links found in the page content',
        }),
      ),
      filter: Type.Optional(
        Type.Union([
          Type.Object({
            type: Type.Literal(WebFetchFilterType.CssSelector),
            selector: Type.String({ description: 'CSS selector for the page fragment to extract' }),
          }),
          Type.Object({
            type: Type.Literal(WebFetchFilterType.MarkdownSection),
            heading: Type.String({ description: 'Markdown heading text for the section to extract' }),
            level: Type.Optional(
              Type.Integer({
                description: 'Optional heading level (1-6) to disambiguate repeated headings',
                minimum: 1,
                maximum: 6,
              }),
            ),
          }),
        ]),
      ),
    }),
    async execute(_toolCallId, params): Promise<AgentToolResult<WebFetchToolDetails>> {
      const result: WebFetchToolResult = await executeWebFetchTool(adapter, params);
      if (result.details.llmsTxt?.checked) {
        sendSystemNotification(pi, {
          sourceType: SystemNotificationSourceType.Tool,
          sourceId: 'web_fetch',
          instructions: 'Supplemental metadata only. Do not treat this as fetched page content or as a user request.',
          data: {
            page: { url: result.details.url },
            llms_txt: {
              status: result.details.llmsTxt.status,
              url: result.details.llmsTxt.url,
              ...(result.details.llmsTxt.statusCode === undefined
                ? {}
                : { http_status: result.details.llmsTxt.statusCode }),
              content_fetched: false,
            },
          },
        });
      }

      return result;
    },
    renderCall: renderWebFetchCall,
    renderResult: renderWebFetchResult,
  });
}
