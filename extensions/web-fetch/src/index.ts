/**
 * Pi extension entry point for web-fetch.
 * Thin glue layer — delegates all logic to framework-independent modules.
 */

import type { AgentToolResult, ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { SimpleFetchAdapter } from './fetch.js';
import { RenderingFetchAdapter, resolveRenderCommand } from './render.js';
import { executeWebFetchTool as defaultExecuteWebFetchTool, type WebFetchToolDetails } from './tool-operation.js';
import { renderWebFetchCall, renderWebFetchResult } from './tool-rendering.js';
import { type FetchAdapter, WebFetchFilterType } from './types.js';

interface WebFetchExtensionDependencies {
  readonly adapter?: FetchAdapter;
  readonly executeWebFetchTool?: typeof defaultExecuteWebFetchTool;
  readonly resolveRenderAdapter?: () => FetchAdapter | undefined;
}

function installedRenderAdapter(): FetchAdapter | undefined {
  const command = resolveRenderCommand(process.env);
  return command ? new RenderingFetchAdapter(command) : undefined;
}

export default async function init(pi: ExtensionAPI, dependencies: WebFetchExtensionDependencies = {}) {
  const adapter = dependencies.adapter ?? new SimpleFetchAdapter();
  const executeWebFetchTool = dependencies.executeWebFetchTool ?? defaultExecuteWebFetchTool;
  const renderAdapter = (dependencies.resolveRenderAdapter ?? installedRenderAdapter)();

  const pageParameters = {
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
          heading: Type.String({
            description:
              'Heading text of the section to extract, without Markdown markup. An exact match wins; ' +
              'otherwise headings that contain the text as a whole phrase match',
          }),
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
  };
  const renderParameter = Type.Optional(
    Type.Boolean({
      description:
        'If true, load the page in a headless browser and run its JavaScript before reading it. ' +
        'Slower, and some sites block it. Use only when a normal fetch returns an empty page shell ' +
        'or loading placeholders',
    }),
  );

  pi.registerTool({
    name: 'web_fetch',
    label: 'Web Fetch',
    description:
      'Fetch a web page and return its content as clean markdown. ' +
      'Use this to read documentation, READMEs, API references, blog posts, ' +
      'package details, or any web page the user points you to. ' +
      "Markdown and plain-text responses are returned unchanged, and a site's own Markdown version of a page " +
      'is used when it offers one. ' +
      'Optionally target part of a page with a filter. ' +
      'Returns structured metadata (title, excerpt, byline) plus the page ' +
      'content converted to token-efficient markdown.',
    promptSnippet: 'Fetch a web page and return clean markdown content',
    // Rendering is offered only when a headless browser is installed, so the model never asks for what cannot run.
    parameters: renderAdapter
      ? Type.Object({ ...pageParameters, render: renderParameter })
      : Type.Object(pageParameters),
    async execute(_toolCallId, params): Promise<AgentToolResult<WebFetchToolDetails>> {
      return executeWebFetchTool(adapter, params, { renderAdapter });
    },
    renderCall: renderWebFetchCall,
    renderResult: renderWebFetchResult,
  });
}
