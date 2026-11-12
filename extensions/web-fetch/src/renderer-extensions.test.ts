import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { describe, expect, it, vi } from 'vitest';
import { WEB_FETCH_RENDERER_CHANNEL, type WebFetchRenderer } from './render.js';
import { createRendererExtension } from './renderer-extensions.js';

function createPi() {
  const handlers = new Map<string, () => unknown>();
  const emit = vi.fn();
  const api = {
    on: (event: string, handler: () => unknown) => {
      handlers.set(event, handler);
    },
    events: { emit },
  } as unknown as ExtensionAPI;

  return { api, emit, fire: (event: string) => handlers.get(event)?.() };
}

describe('createRendererExtension', () => {
  it('registers its renderer during resource discovery when the browser is installed', async () => {
    const renderer: WebFetchRenderer = { id: 'browser', render: vi.fn() };
    const env = { PATH: '/somewhere' };
    const createRenderer = vi.fn(() => renderer);
    const pi = createPi();

    await createRendererExtension(createRenderer, env)(pi.api);
    expect(pi.emit).not.toHaveBeenCalled();
    pi.fire('resources_discover');

    expect(createRenderer).toHaveBeenCalledWith(env);
    expect(pi.emit).toHaveBeenCalledWith(WEB_FETCH_RENDERER_CHANNEL, renderer);
  });

  it('registers nothing when the browser is not installed', async () => {
    const pi = createPi();

    await createRendererExtension(() => undefined, {})(pi.api);
    pi.fire('resources_discover');

    expect(pi.emit).not.toHaveBeenCalled();
  });
});
