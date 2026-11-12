// A web_fetch renderer that needs no browser: it returns a fixed page that names the URL it was
// asked for. Loaded via -e by web-fetch-render.integration.test.ts.

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export const RENDERER_FIXTURE_MARKER = 'Rendered by the fixture renderer';

export default function (pi: ExtensionAPI) {
  pi.on('resources_discover', () => {
    pi.events.emit('sandpiper:web-fetch-renderer', {
      id: 'fixture',
      render: async (request: { readonly url: string }) => ({
        html: `<html><head><title>Fixture page</title></head><body><article>
<h1>Fixture page</h1>
<p>${RENDERER_FIXTURE_MARKER} for ${request.url}. This paragraph is long enough for the reader
extraction to treat the document as an article, so the pipeline returns it as content.</p>
<p>A second paragraph adds more text, which keeps the extraction from falling back to the raw page.</p>
</article></body></html>`,
      }),
    });
  });
}
