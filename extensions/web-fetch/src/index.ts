/**
 * Pi extension entry point for web-fetch.
 * Thin glue layer — delegates all logic to framework-independent modules.
 */

import { StringEnum } from '@earendil-works/pi-ai';
import type { AgentToolResult, ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { SimpleFetchAdapter } from './fetch.js';
import { NO_RENDERER, RendererCollector, RendererFetchAdapter, WEB_FETCH_RENDERER_CHANNEL } from './render.js';
import { executeWebFetchTool as defaultExecuteWebFetchTool, type WebFetchToolDetails } from './tool-operation.js';
import { renderWebFetchCall, renderWebFetchResult } from './tool-rendering.js';
import { type FetchAdapter, WebFetchFilterType } from './types.js';

interface WebFetchExtensionDependencies {
  readonly adapter?: FetchAdapter;
  readonly executeWebFetchTool?: typeof defaultExecuteWebFetchTool;
}

export default async function init(pi: ExtensionAPI, dependencies: WebFetchExtensionDependencies = {}) {
  const adapter = dependencies.adapter ?? new SimpleFetchAdapter();
  const executeWebFetchTool = dependencies.executeWebFetchTool ?? defaultExecuteWebFetchTool;
  const renderers = new RendererCollector();
  // One adapter per registered renderer, in id order. Empty until the first run settles them.
  let renderAdapters: ReadonlyMap<string, FetchAdapter> = new Map();
  let renderersSettled = false;
  let stopCollecting: (() => void) | undefined;

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

  // The schema offers only what can run, in one field: a switch for a single renderer, a choice
  // when there are several. Two coupled fields would leave their combinations open to guessing.
  const toolParameters = () => {
    const ids = [...renderAdapters.keys()];
    if (ids.length === 0) return Type.Object(pageParameters);
    if (ids.length === 1) return Type.Object({ ...pageParameters, render: renderParameter });

    return Type.Object({
      ...pageParameters,
      renderer: Type.Optional(
        StringEnum([NO_RENDERER, ...ids], {
          default: NO_RENDERER,
          description:
            `Headless browser to load the page in, so its JavaScript runs before the page is read. ` +
            `"${NO_RENDERER}" (the default) is a normal fetch. A browser is slower, and some sites block it. ` +
            'Use one only when a normal fetch returns an empty page shell or loading placeholders, ' +
            'and try another when one reports that the site blocked it',
        }),
      ),
    });
  };

  const registerTool = (): void => {
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
      parameters: toolParameters(),
      async execute(_toolCallId, params, signal): Promise<AgentToolResult<WebFetchToolDetails>> {
        return executeWebFetchTool(adapter, params, { renderAdapters, signal });
      },
      renderCall: renderWebFetchCall,
      renderResult: renderWebFetchResult,
    });
  };

  // Registered at load so the tool's prompt entry exists from the first run. Renderers register
  // later, so the first run registers the tool again with the final schema, before any request.
  registerTool();

  pi.on('session_start', () => {
    stopCollecting?.();
    stopCollecting = pi.events.on(WEB_FETCH_RENDERER_CHANNEL, (registration) => renderers.add(registration));
  });

  pi.on('before_agent_start', () => {
    if (renderersSettled) return;
    renderersSettled = true;
    stopCollecting?.();
    stopCollecting = undefined;

    const registered = renderers.renderers();
    if (registered.length === 0) return;
    renderAdapters = new Map(registered.map((renderer) => [renderer.id, new RendererFetchAdapter(renderer)]));
    registerTool();
  });

  pi.on('session_shutdown', () => {
    stopCollecting?.();
    stopCollecting = undefined;
  });
}
