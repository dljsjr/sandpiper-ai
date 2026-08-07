// Loaded via -e on every isolated integration-test spawn (see harness.ts). Monkeypatches
// every real HTTP transport this dependency tree is known to use -- globalThis.fetch,
// node:https's `.request` (via a require()'d CJS reference), and node:http2's `.connect`
// (same mechanism) -- so attempted network egress during an isolated test rejects/throws
// immediately, regardless of which code path caused it (wrong provider resolution, an
// extension under test making its own incidental fetch, a future pi regression). This is
// deliberately process-wide, not scoped to "the mock provider's own requests" -- it is the
// harness's actual no-fallback guarantee, not a courtesy the mock provider extends by
// choosing not to call the network.
//
// THREAT MODEL: enumeration + canary + backstop, three layers, each one's failure caught by
// the next. This is not a euphemism for "we patched some things and hoped" -- it is the
// documented, load-bearing shape of the guarantee, arrived at only after this layer actually
// failed once during AGENT-252 and the next layer caught it. Read that incident before
// trusting this file:
//
// 1. PREVENTION is transport-enumerated, not universal. Today's verified-complete set for
//    this dependency tree is `fetch` + `node:https.request` + `node:http2.connect` (see the
//    per-transport evidence below for how each was found and confirmed). Enumeration means
//    there is no proof a fourth transport doesn't exist somewhere in this dependency tree or a
//    future version of it -- the claim is "everything checked so far," not "everything."
// 2. Because (1) is an enumeration, not a proof, EVERY PROVIDER-FAMILY GUARD-FIRES TEST
//    (network-deny-guard-fires.integration.test.ts) IS A DRIFT CANARY, not just a one-time
//    verification. If a future SDK version, a new provider, or an upstream pi change picks a
//    transport this file doesn't patch, the canary's failure mode is loud and specific: the
//    diagnostic log (see NETWORK_DENY_GUARD_LOG_ENV_VAR below) shows nothing intercepted for
//    that provider, the sentinel never fires, and the test fails -- in CI, not in a freeze.
// 3. Because (2) can still be a real request in flight for however long it takes CI to catch
//    it, harness.ts pins fake AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY/AWS_PROFILE
//    unconditionally as a backstop below the canary: even an undetected transport gap
//    authenticates as garbage and gets rejected by the real provider, bounding the blast
//    radius to a 403/authentication failure rather than a request that succeeds against real
//    credentials.
//
// THE INCIDENT THAT ESTABLISHED THIS MODEL (2026-08-07, during AGENT-252): building the
// Bedrock guard-fires test surfaced that this file's https.request patch does NOT protect
// Bedrock traffic. `@aws-sdk/client-bedrock-runtime`'s `dist-cjs/runtimeConfig.js:62` defaults
// its request handler to `NodeHttp2Handler`, not the `NodeHttpHandler` (HTTP/1.1,
// `node:https.request`) this file had verified and patched -- a real, unpatched gap. A real
// dispatch against `--provider amazon-bedrock` (with fake AWS credentials, per the backstop
// above) reached AWS's real servers and got back a real, structured rejection:
// `UnrecognizedClientException`, HTTP 403, with a real AWS `requestId`
// (`6a01f6f7-ae33-4d21-b4d8-46f0ba74a5fc`). Layer (1) had a real gap; layer (3) is what
// actually stopped the request from succeeding, exactly as designed -- the fake-credential
// backstop's first live validation. The fix (patching `node:http2`'s `.connect`, documented
// below) closes the gap layer (1) should have covered; layer (2) -- turning that one-off
// discovery into a standing test that would have caught this automatically -- is what makes
// this incident not need to happen again by hand.
//
// Per-transport evidence (verified empirically rather than assumed, corrected in place where
// an earlier draft got it wrong -- documented so mistakes stay visible rather than silently
// disappearing from history):
//
// - `import * as http from 'node:http'` yields an ECMAScript module namespace object, which
//   is exotic-object-immutable from outside the module -- confirmed with a standalone bun
//   script: assigning `http.request = ...` throws even via `Object.defineProperty` with
//   `configurable:true` ("Cannot replace module namespace object's binding"). Code that reads
//   node:http/node:https/node:http2 through an ESM `import` (static or dynamic) cannot be
//   intercepted by mutating a module object at all -- there is no external handle to mutate.
// - Code that reads a builtin through a plain CJS `require(...)` CAN be intercepted: require()
//   returns the same cached singleton object across every caller in the process (this guard's
//   own `require(...)` and any other module's), and mutating a plain object's property is an
//   ordinary assignment, not a namespace-object write. This is exactly why an earlier draft's
//   http.request patch attempt failed for its own test (it mutated a `require()`-obtained
//   object but verified the result by reading through a *separate* `import * as http`
//   binding -- a require/import interop mismatch, not a fundamentally unpatchable target), and
//   why the https.request and http2.connect patches below don't have that problem: both
//   smithy consumers are require()-to-require() throughout.
// - `@anthropic-ai/sdk`/`openai` (used by pi-ai's Anthropic and OpenAI-family providers)
//   resolve their HTTP client via a bare `fetch` global read at call time
//   (`@anthropic-ai/sdk/internal/shims.js`'s `getDefaultFetch()`) -- `globalThis.fetch`,
//   patchable directly, no require/import distinction to navigate.
// - `@smithy/node-http-handler`'s bundled `dist-cjs/index.js` does `var node_https =
//   require('node:https');` at module scope (line 3) and calls `node_https.request` as a
//   property lookup performed AT CALL TIME inside its request-sending function (line 344, not
//   a destructured/cached reference taken once at load). The same file also does `var http2 =
//   require('node:http2');` (line 6) and calls `http2.connect(url)` the same way (line 665).
//   Both are call-time lookups on the shared require()'d singleton, so both patches intercept
//   regardless of whether smithy's module evaluates before or after this guard installs.
// - `NodeHttpHandler`'s plain-HTTP (non-TLS) fallback (`hRequest`, populated via `const {
//   request } = await import('node:http')`) is an ESM dynamic import and remains genuinely
//   unreachable by any monkeypatch, for the same immutability reason as node:http generally.
//   This is a real, named residual -- but real AWS/Bedrock endpoints are always TLS/H2, so
//   `isSSL` is always true and `NodeHttpHandler`'s plain-HTTP path never actually runs for
//   real traffic; `NodeHttp2Handler` is Bedrock's actual default anyway (see the incident
//   above), and its own http2.connect call-time lookup is what's patched, not this residual.
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

import { appendFileSync } from 'node:fs';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

/** Prefix every thrown/rejected error carries. NOT reliably visible to a test through pi's own
 * RPC/print-mode error surface -- confirmed empirically while building AGENT-252's guard-fires
 * proof: the `@anthropic-ai/sdk` wraps a rejected fetch in `APIConnectionError({ cause:
 * response })`, and pi-ai's `normalizeProviderError()` reads `error.message` (the SDK's own
 * generic "Connection error."), not `error.cause.message` -- so this sentinel text never
 * reaches `errorMessage` on the RPC wire. Kept for readability of exceptions raised directly
 * inside this process (the in-process unit test, `network-deny-guard.test.ts`, sees it fine),
 * but a spawned-process test cannot rely on it. {@link NETWORK_DENY_GUARD_LOG_ENV_VAR} is the
 * mechanism that actually gives spawned-process tests an unambiguous signal -- first-class,
 * not scaffolding: it is the only way to assert guard-firing from outside the process. */
export const NETWORK_DENY_SENTINEL = 'network-deny-guard: blocked';

/** When set to a file path, every denied call is also appended there as a plain line (`fetch
 * <url>`, `https.request`, or `http2.connect <url>`), independent of whatever pi's own error
 * normalization does with the rejection. This is the mechanism AGENT-252's guard-fires tests
 * actually read, and the drift canary described in the module comment above reads the same
 * way: absence of an expected line is exactly as meaningful as its presence. */
export const NETWORK_DENY_GUARD_LOG_ENV_VAR = 'SANDPIPER_INTEGRATION_GUARD_LOG';

function logDenial(label: string): void {
  const logPath = process.env[NETWORK_DENY_GUARD_LOG_ENV_VAR];
  if (!logPath) {
    return;
  }
  try {
    appendFileSync(logPath, `${label}\n`);
  } catch {
    // Best-effort; a failed diagnostic write must not mask the deny itself.
  }
}

function deny(label: string): never {
  logDenial(label);
  throw new Error(`${NETWORK_DENY_SENTINEL} ${label} during isolated integration test`);
}

export default function (_pi: ExtensionAPI) {
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const label = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    logDenial(`fetch ${label}`);
    return Promise.reject(new Error(`${NETWORK_DENY_SENTINEL} fetch(${label}) during isolated integration test`));
  }) as typeof fetch;

  // require(), not `import * as https`/`import * as http2` -- see the module comment above
  // for why the ESM namespace form cannot be mutated, and why this CJS singleton form can.
  const httpsModule = require('node:https') as typeof import('node:https');
  httpsModule.request = (() => deny('https.request')) as typeof httpsModule.request;

  const http2Module = require('node:http2') as typeof import('node:http2');
  http2Module.connect = ((authority: string | URL) => {
    deny(`http2.connect ${String(authority)}`);
  }) as typeof http2Module.connect;
}
