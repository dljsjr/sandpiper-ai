// Two web_fetch renderers that need no browser: each returns a fixed page that names itself and
// the URL it was asked for. Two, so the tool always offers a choice of renderer, whatever
// browsers the machine has. Loaded via -e by web-fetch-render.integration.test.ts.

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export const RENDERER_FIXTURE_IDS = ['fixture-a', 'fixture-b'] as const;

export function rendererFixtureMarker(id: string, url: string): string {
  return `Rendered by ${id} for ${url}`;
}

export default function (pi: ExtensionAPI) {
  pi.on('resources_discover', () => {
    for (const id of RENDERER_FIXTURE_IDS) {
      pi.events.emit('sandpiper:web-fetch-renderer', {
        id,
        render: async (request: { readonly url: string }) => ({
          html: `<html><head><title>Fixture page</title></head><body><article>
<h1>Fixture page</h1>
<p>${rendererFixtureMarker(id, request.url)}. This paragraph is long enough for the reader
extraction to treat the document as an article, so the pipeline returns it as content.</p>
<p>A second paragraph adds more text, which keeps the extraction from falling back to the raw page.</p>
</article></body></html>`,
        }),
      });
    }
  });
}
