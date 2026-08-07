// Loaded via -e on every isolated integration-test spawn (see harness.ts). Monkeypatches
// globalThis.fetch in the spawned process so ANY attempted network egress during an isolated
// test rejects immediately -- regardless of which code path caused it (wrong provider
// resolution, an extension under test making its own incidental fetch, a future pi
// regression). This is deliberately process-wide, not scoped to "the mock provider's own
// requests" -- it is the harness's actual no-fallback guarantee, not a courtesy the mock
// provider extends by choosing not to call the network.
//
// Scope, verified empirically rather than assumed (an earlier draft of this file also tried
// to patch node:http/node:https and shipped a broken mechanism -- documented here so the
// mistake stays visible rather than silently disappearing from history):
// - `import * as http from 'node:http'` yields an ECMAScript module namespace object, which
//   is exotic-object-immutable from outside the module -- confirmed with a standalone bun
//   script: assigning `http.request = ...` throws even via `Object.defineProperty` with
//   `configurable:true` ("Cannot replace module namespace object's binding"), and mutating a
//   *separately obtained* `require('node:http')` CJS object does NOT affect the ESM
//   namespace's own `.request` binding (confirmed: `httpEsm.request !== httpCjs.request`
//   after mutation; calling through the ESM reference still ran the original, unpatched
//   function). So a node:http/node:https patch cannot actually intercept calls made through
//   an ESM import of those modules, however it's implemented.
// - It doesn't matter here anyway: grepped the full installed pi-ai + pi-coding-agent dist
//   tree for `http.request`/`https.request`/direct `undici` request usage -- zero hits.
//   pi-ai's Anthropic and OpenAI-family providers go through the official `@anthropic-ai/sdk`
//   and `openai` SDK packages, both of which resolve their HTTP client via
//   `getDefaultFetch()` reading the bare `fetch` global at call time (confirmed by reading
//   `@anthropic-ai/sdk/internal/shims.js`). `globalThis.fetch` -- a plain, externally
//   mutable global, not a module namespace object -- is the actual, sufficient interception
//   point for this dependency chain.
//
// Load-ordering guarantee (traced, not assumed -- see
// .sandpiper/docs/specs/agent-249-headless-cli-integration-harness-design.md): every
// extension factory, this one included, runs to completion inside
// resourceLoader.reload()/createAgentSessionServices(), strictly before pi resolves a model or
// could construct a provider's network client. pi's own configureHttpDispatcher() (main.js,
// called after extension loading) explicitly checks whether `globalThis.fetch` still equals
// its own captured original before installing undici's fetch implementation over it -- so a
// fetch override already in place when it runs is preserved, not overwritten.
//
// No restore path: each spawned process is a throwaway for exactly one isolated test.

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

/** Prefix every rejection carries, so tests (and AGENT-252's guard-fires proof) can
 * distinguish "the guard caught an escape attempt" from a real network error or a hang. */
export const NETWORK_DENY_SENTINEL = 'network-deny-guard: blocked';

export default function (_pi: ExtensionAPI) {
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const label = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    return Promise.reject(new Error(`${NETWORK_DENY_SENTINEL} fetch(${label}) during isolated integration test`));
  }) as typeof fetch;
}
