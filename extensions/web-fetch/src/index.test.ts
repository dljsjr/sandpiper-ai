import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { describe, expect, it, vi } from 'vitest';
import init from './index.js';
import { RendererFetchAdapter, WEB_FETCH_RENDERER_CHANNEL, type WebFetchRenderer } from './render.js';
import type { WebFetchToolInput, WebFetchToolResult } from './tool-operation.js';
import { type FetchAdapter, WebFetchFilterType } from './types.js';

interface RegisteredWebFetchTool {
  readonly promptSnippet?: string;
  readonly parameters?: unknown;
  execute(toolCallId: string, params: WebFetchToolInput, signal?: AbortSignal): Promise<WebFetchToolResult>;
}

type Handler = (...args: unknown[]) => unknown;

/** The parts of Pi this extension uses: tool registration, lifecycle events and the event bus. */
function createPi() {
  const lifecycle = new Map<string, Handler[]>();
  const bus = new Map<string, Set<Handler>>();
  const registerTool = vi.fn<(tool: RegisteredWebFetchTool) => void>();
  const api = {
    registerTool,
    on: (event: string, handler: Handler) => {
      lifecycle.set(event, [...(lifecycle.get(event) ?? []), handler]);
    },
    events: {
      on: (channel: string, handler: Handler) => {
        const handlers = bus.get(channel) ?? new Set<Handler>();
        bus.set(channel, handlers.add(handler));
        return () => handlers.delete(handler);
      },
      emit: (channel: string, data: unknown) => {
        for (const handler of bus.get(channel) ?? []) handler(data);
      },
    },
  };

  return {
    api: api as unknown as ExtensionAPI,
    registerTool,
    fire: (event: string) => {
      for (const handler of lifecycle.get(event) ?? []) handler({}, {});
    },
    emit: api.events.emit,
    latestTool: () => registerTool.mock.calls.at(-1)?.[0],
  };
}

function createAdapter(): FetchAdapter {
  return {
    fetch: vi.fn(),
  };
}

function createRenderer(id: string): WebFetchRenderer {
  return { id, render: vi.fn(async () => ({ html: '<html><body>rendered</body></html>' })) };
}

function okResult(): WebFetchToolResult {
  return { content: [{ type: 'text', text: 'ok' }], details: { url: 'https://example.com/page', title: 'Example' } };
}

describe('web-fetch extension', () => {
  it('opts into the available-tools system prompt list', async () => {
    const pi = createPi();

    await init(pi.api, { adapter: createAdapter() });

    expect(pi.latestTool()?.promptSnippet).toBe('Fetch a web page and return clean markdown content');
  });

  it('registers both CSS selector and Markdown section filter schemas', async () => {
    const pi = createPi();

    await init(pi.api, { adapter: createAdapter() });

    const schemaText = JSON.stringify(pi.latestTool()?.parameters);
    expect(schemaText).toContain(WebFetchFilterType.CssSelector);
    expect(schemaText).toContain(WebFetchFilterType.MarkdownSection);
    expect(schemaText).toContain('heading');
  });

  it.each([
    ['css_selector filter arm', { type: WebFetchFilterType.CssSelector, selector: '.article' }],
    ['markdown_section filter arm', { type: WebFetchFilterType.MarkdownSection, heading: 'Usage', level: 2 }],
  ] as const)(
    'passes the %s through execute() unmangled (union-arm preservation regression, #7328)',
    async (_label, filter) => {
      const executeWebFetchTool = vi.fn(async () => okResult());
      const pi = createPi();

      await init(pi.api, { adapter: createAdapter(), executeWebFetchTool });
      await pi.latestTool()?.execute('call-1', { url: 'https://example.com/page', filter });

      // The union arm's exact fields (including the 'type' discriminant) must reach our
      // execution layer unchanged -- not coerced, not stripped, not merged with the other arm's
      // shape. This is the class of bug #7328 fixed on Pi's side (nullable-union coercion
      // silently replacing an already-valid value); this test guards our own consumption of
      // whatever Pi hands us for this schema.
      expect(executeWebFetchTool).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ url: 'https://example.com/page', filter }),
        expect.anything(),
      );
    },
  );

  it("passes the turn's abort signal to the tool operation", async () => {
    const executeWebFetchTool = vi.fn(async () => okResult());
    const { signal } = new AbortController();
    const pi = createPi();

    await init(pi.api, { adapter: createAdapter(), executeWebFetchTool });
    await pi.latestTool()?.execute('call-1', { url: 'https://example.com/page' }, signal);

    expect(executeWebFetchTool).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ signal }),
    );
  });

  it('returns the tool result unchanged', async () => {
    const toolResult = okResult();
    const pi = createPi();

    await init(pi.api, {
      adapter: createAdapter(),
      executeWebFetchTool: vi.fn(async () => toolResult),
    });

    expect(await pi.latestTool()?.execute('call-1', { url: 'https://example.com/page' })).toBe(toolResult);
  });
});

describe('web-fetch renderers', () => {
  interface Schema {
    readonly properties: Record<string, { readonly enum?: readonly string[]; readonly default?: string }>;
  }

  async function start(rendererIds: readonly string[], executeWebFetchTool = vi.fn(async () => okResult())) {
    const pi = createPi();
    const registered = rendererIds.map(createRenderer);

    await init(pi.api, { adapter: createAdapter(), executeWebFetchTool });
    pi.fire('session_start');
    for (const renderer of registered) pi.emit(WEB_FETCH_RENDERER_CHANNEL, renderer);
    pi.fire('before_agent_start');

    return { pi, registered, executeWebFetchTool, schema: () => pi.latestTool()?.parameters as Schema };
  }

  it('registers the tool at load without rendering, and leaves it alone when no renderer is registered', async () => {
    const { pi, schema } = await start([]);

    expect(pi.registerTool).toHaveBeenCalledTimes(1);
    expect(Object.keys(schema().properties)).toEqual(['url', 'followLinks', 'filter']);
  });

  it('adds only the render switch when one renderer is registered', async () => {
    const { pi, schema } = await start(['lightpanda']);

    expect(pi.registerTool).toHaveBeenCalledTimes(2);
    expect(Object.keys(schema().properties)).toEqual(['url', 'followLinks', 'filter', 'render']);
  });

  it('replaces the render switch with one choice of renderer, off by default, when several are registered', async () => {
    const { pi, schema } = await start(['obscura', 'lightpanda']);

    expect(pi.registerTool).toHaveBeenCalledTimes(2);
    expect(Object.keys(schema().properties)).toEqual(['url', 'followLinks', 'filter', 'renderer']);
    expect(schema().properties.renderer?.enum).toEqual(['none', 'lightpanda', 'obscura']);
    expect(schema().properties.renderer?.default).toBe('none');
  });

  it('hands the tool operation one adapter per renderer, in id order', async () => {
    const { pi, registered, executeWebFetchTool } = await start(['obscura', 'lightpanda']);

    await pi.latestTool()?.execute('call-1', { url: 'https://example.com/app', renderer: 'obscura' });
    const [, , dependencies] = executeWebFetchTool.mock.calls[0] as unknown as [
      unknown,
      unknown,
      { renderAdapters: ReadonlyMap<string, FetchAdapter> },
    ];
    await dependencies.renderAdapters.get('obscura')?.fetch('https://example.com/app');

    expect([...dependencies.renderAdapters.keys()]).toEqual(['lightpanda', 'obscura']);
    expect(dependencies.renderAdapters.get('obscura')).toBeInstanceOf(RendererFetchAdapter);
    expect(registered[0]?.render).toHaveBeenCalledTimes(1);
    expect(registered[1]?.render).not.toHaveBeenCalled();
  });

  it('settles the renderers on the first run and does not register the tool again', async () => {
    const { pi, schema } = await start(['lightpanda']);

    pi.emit(WEB_FETCH_RENDERER_CHANNEL, createRenderer('late'));
    pi.fire('before_agent_start');

    expect(pi.registerTool).toHaveBeenCalledTimes(2);
    expect(Object.keys(schema().properties)).not.toContain('renderer');
  });
});
