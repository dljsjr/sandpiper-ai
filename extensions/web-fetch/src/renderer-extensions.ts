/**
 * Pi extensions that register the bundled renderers. They use the same event bus channel and
 * contract as a renderer from any other extension.
 */

import type { ExtensionAPI, ExtensionFactory } from '@earendil-works/pi-coding-agent';
import { createLightpandaRenderer } from './lightpanda-renderer.js';
import { createObscuraRenderer } from './obscura-renderer.js';
import { WEB_FETCH_RENDERER_CHANNEL, type WebFetchRenderer } from './render.js';

type RendererFactory = (env: NodeJS.ProcessEnv) => WebFetchRenderer | undefined;

/** An extension that registers a renderer when its browser is installed, and nothing otherwise. */
export function createRendererExtension(
  createRenderer: RendererFactory,
  env: NodeJS.ProcessEnv = process.env,
): ExtensionFactory {
  return (pi: ExtensionAPI) => {
    pi.on('resources_discover', () => {
      const renderer = createRenderer(env);
      if (renderer) pi.events.emit(WEB_FETCH_RENDERER_CHANNEL, renderer);
    });
  };
}

export const lightpandaRendererExtension = createRendererExtension(createLightpandaRenderer);
export const obscuraRendererExtension = createRendererExtension(createObscuraRenderer);
