// Loaded via -e on every isolated integration-test spawn (see harness.ts). Monkeypatches
// globalThis.fetch and, via a require()'d CJS reference, node:https's `.request` so that
// attempted network egress during an isolated test rejects/throws immediately -- regardless
// of which code path caused it (wrong provider resolution, an extension under test making its
// own incidental fetch, a future pi regression). This is deliberately process-wide, not
// scoped to "the mock provider's own requests" -- it is the harness's actual no-fallback
// guarantee, not a courtesy the mock provider extends by choosing not to call the network.
//
// Scope, verified empirically rather than assumed (an earlier draft of this file also tried
// to patch node:http alongside node:https and shipped a broken version of both -- documented
// here so the mistake and its correction stay visible rather than silently disappearing from
// history):
//
// - `import * as http from 'node:http'` yields an ECMAScript module namespace object, which
//   is exotic-object-immutable from outside the module -- confirmed with a standalone bun
//   script: assigning `http.request = ...` throws even via `Object.defineProperty` with
//   `configurable:true` ("Cannot replace module namespace object's binding"). Code that reads
//   node:http/node:https through an ESM `import` (static or dynamic) cannot be intercepted by
//   mutating a module object at all -- there is no external handle to mutate.
// - Code that reads node:https through a plain CJS `require('node:https')` CAN be intercepted:
//   require() returns the same cached singleton object across every caller in the process
//   (this guard's own `require('node:https')` and any other module's), and mutating a plain
//   object's property is an ordinary assignment, not a namespace-object write. This is exactly
//   why the original patch attempt above failed for its own test, and why this one doesn't:
//   the original mutated a `require()`-obtained object but verified the result by reading
//   through a *separate* `import * as http` binding -- a require/import interop mismatch, not
//   a fundamentally unpatchable target. Smithy (below) is require()-to-require() throughout,
//   so there's no such mismatch: this guard's `require('node:https')` and smithy's own
//   `require('node:https')` resolve to the identical cached object.
// - pi-ai's own dependency tree does not call node:http/node:https directly anywhere (grepped
//   the installed pi-ai + pi-coding-agent dist trees -- zero hits) -- its Anthropic and
//   OpenAI-family providers go through the official `@anthropic-ai/sdk`/`openai` SDK packages,
//   which resolve their HTTP client via a bare `fetch` global read at call time
//   (`@anthropic-ai/sdk/internal/shims.js`'s `getDefaultFetch()`). But pi-ai's Bedrock provider
//   (`api/bedrock-converse-stream.js`) imports `@aws-sdk/client-bedrock-runtime`, which uses
//   `@smithy/node-http-handler` -- and THAT package's dist-cjs/index.js does
//   `var node_https = require('node:https');` at module scope and calls `node_https.request`
//   as a property lookup performed AT CALL TIME inside its request-sending function (not a
//   destructured/cached reference taken once at load) -- confirmed by reading the source.
//   Patching the shared `node:https` singleton's `.request` therefore intercepts smithy's SSL
//   path regardless of load order: it doesn't matter whether smithy's module evaluates before
//   or after this guard installs, because smithy re-reads `node_https.request` fresh on every
//   call rather than caching it once.
// - The same file ALSO does `const { Agent, request } = await import('node:http'); hRequest =
//   request;` for its plain-HTTP fallback (used when a request is not TLS) -- an ESM dynamic
//   import, so this guard cannot intercept it for the same namespace-object-immutability
//   reason as node:http generally. This is a real, named residual: a genuinely non-TLS
//   AWS/Bedrock-style endpoint would bypass this guard entirely. It is not exercised in
//   practice -- real AWS/Bedrock endpoints are always TLS, so `isSSL` is always true and the
//   patched `node_https.request` path is what actually runs -- but "not exercised in
//   practice" is a narrower, more honest claim than "not possible," and is recorded as such
//   rather than folded into "fully covered."
//
// Load-ordering guarantee (traced, not assumed -- see
// .sandpiper/docs/specs/agent-249-headless-cli-integration-harness-design.md): every extension
// factory, this one included, runs to completion inside
// resourceLoader.reload()/createAgentSessionServices(), strictly before pi resolves a model or
// could construct a provider's network client. pi's own configureHttpDispatcher() (main.js,
// called after extension loading) explicitly checks whether `globalThis.fetch` still equals
// its own captured original before installing undici's fetch implementation over it -- so a
// fetch override already in place when it runs is preserved, not overwritten.
//
// No restore path: each spawned process is a throwaway for exactly one isolated test.

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

/** Prefix every thrown/rejected error carries, so tests (and AGENT-252's guard-fires proof)
 * can distinguish "the guard caught an escape attempt" from a real network error or a hang. */
export const NETWORK_DENY_SENTINEL = 'network-deny-guard: blocked';

function deny(label: string): never {
  throw new Error(`${NETWORK_DENY_SENTINEL} ${label} during isolated integration test`);
}

export default function (_pi: ExtensionAPI) {
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const label = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    return Promise.reject(new Error(`${NETWORK_DENY_SENTINEL} fetch(${label}) during isolated integration test`));
  }) as typeof fetch;

  // require(), not `import * as https` -- see the module comment above for why the ESM
  // namespace form cannot be mutated, and why this CJS singleton form can.
  const httpsModule = require('node:https') as typeof import('node:https');
  httpsModule.request = (() => deny('https.request')) as typeof httpsModule.request;
}
