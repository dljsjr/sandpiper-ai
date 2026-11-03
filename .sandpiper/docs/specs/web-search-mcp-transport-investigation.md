# Pi's MCP client behind the web search tool

Mode: Explanation
Task: TOOLS-99, related to TOOLS-92 and TOOLS-30
Status: Research accepted. Native adoption under TOOLS-100–102 is implemented, verified, and independently reviewed. Final implementation acceptance remains separate. Evidence distinguishes the research baseline from integrated verification.

Pi's standalone MCP client can call the upstream service behind our existing `web_search` tool. The upstream service does not need a REST endpoint. The investigation changed no application code or dependencies. Implementation follows the accepted research.

## Keep the existing tool boundary

At the research baseline, mcporter backed `web_search`, not `web_fetch`. `web_fetch` uses ordinary HTTP through `SimpleFetchAdapter`. The original WEB-11 decision records these sibling tools and their separate roles.

The request path before adoption was:

```text
web_search
  -> ParallelMcpSearchAdapter
  -> mcporter library
  -> Parallel MCP web_search
  -> parseParallelResult
  -> our search-result formatter
```

The adapter imports mcporter as a library. It does not launch the mcporter CLI. Its explicit server definition avoids mcporter configuration discovery.

Brave remains the primary provider when its key resolves. Parallel supplies the anonymous fallback at `https://search.parallel.ai/mcp`. A client replacement can keep this selection and our public tool contract.

The existing contract includes:

- An empty query returns without a connection. Other queries are trimmed.
- The adapter sends `objective`, `search_queries`, and a stable per-adapter `session_id`.
- The parser maps text content to title, URL, and snippet rows. It applies the result limit locally.
- The tool call uses a 15-second timeout by default. That limit does not cover the preceding connection setup.
- Each search owns one client lifetime. Best-effort cleanup cannot replace a successful result with a close error.

`SearchAdapterOptions.signal` exists, but the tool and Parallel adapter do not forward it today. Adding user cancellation is separate work. This investigation does not treat that addition as behavior preservation.

## Use the standalone client, not host-managed tools

The installed `@earendil-works/pi-mcp` version is 1.3.0. Its public API exports `McpClient` and `StreamableHttpTransport`. This standalone package does not depend on Pi's agent host or the official MCP SDK.

The client can connect and call the known upstream `web_search` tool directly. It does not require `tools/list` or agent-tool registration. Our existing parser can consume the raw MCP result.

The candidate path replaces only the mcporter library in the diagram. Our tool name, schema, provider selection, result formatting, and error wrapper remain in place. The upstream tools do not enter the model's tool catalogue.

Pi's host-managed MCP route serves a different purpose. It manages configured servers, registered tools, authentication, and logs. Even hidden host tools remain registered tools, so that route adds machinery that this adapter does not need.

The standalone client does not load user MCP configuration or credentials. Its HTTP transport accepts an explicit URL, headers, and an optional fetch implementation. No new MCP configuration file is needed for the current anonymous service.

## Evidence from the pinned client

A temporary Bun 1.4.4 probe exercised the installed client and HTTP transport with an injected fake fetch function. An unconfigured global fetch throws. Every endpoint and header in the probe uses fake data.

The probe passed 15 cases. The lead reran the probe and its strict API signature typecheck. Existing parser and provider-selection tests also passed, with 14 tests across two files.

The normal trace was:

```text
initialize
  -> notifications/initialized
  -> optional GET stream
  -> tools/call(web_search)
  -> DELETE session on close
```

The probe sent no `tools/list` request. It used the same tool arguments and client identity as the current adapter. The real `parseParallelResult` function returned the expected trimmed, count-limited rows.

Other cases covered streamed responses, response resumption, tool errors, protocol errors, authentication failures, expired sessions, malformed results, cancellation, and timeouts. They also covered an unsupported optional GET and a stalled initialization notification. No request reached Parallel or another real service.

The temporary evidence is `/tmp/tools99-native-mcp.f3C1Rv/`. It contains `probe.ts`, `api-check.ts`, and `result.json`. Temporary files are not permanent regression coverage.

## Compatibility limits

The successful probe establishes a client integration path, not a complete replacement contract. It does not certify the live Parallel endpoint. These differences remain relevant to adoption:

- The native client supports Streamable HTTP, including streamed response bodies. It does not support the older separate HTTP+SSE transport that mcporter can try as a fallback.
- The native request timeout defaults to 30 seconds. Constructor and per-call values are available, but there is no `maxTotalTimeout` option. The current hard tool-call limit must remain intact.
- The request timer does not cover a stalled `notifications/initialized` POST. In the probe, an external close ended that stall. Connection setup and tool-call deadlines need separate treatment.
- Cancellation rejects the request and sends an MCP cancellation notification. It does not abort an already dispatched HTTP call until the transport closes. Cleanup in `finally` remains necessary.
- Native close aborts connection I/O and attempts session deletion with a separate one-second limit. This does not prove that remote computation stops or that every background task finishes.

A result with `isError: true` resolves as an MCP result. Protocol errors throw. The current parser does not separately interpret `isError` or structured-only results, so client replacement must not silently change that policy.

The native client without an authentication provider reports a 401 error without an OAuth flow. mcporter contains additional authentication, recording, replay, and compatibility behavior. This proposal targets the anonymous Streamable HTTP path that our adapter uses, not every mcporter feature.

## Dependency and ownership implications

Pi's coding-agent package already depends on `@earendil-works/pi-mcp@1.3.0`. The current product already ships it through its bundled dependency closure. The root build also externalizes `@earendil-works/*`.

A direct application import still needs an explicit dependency. Adoption requires exact declarations in the web-search package and the root product's runtime and bundled dependency lists. It cannot rely on an incidental transitive dependency location.

The application can then remove its mcporter library dependency. That change does not remove the independently installed mcporter developer CLI from `mise.toml`. No dependency declarations, lockfile entries, or developer tools changed during this investigation.

## Approved implementation

Doug accepted the research and required this replacement in the current simplification work. TOOLS-100–102 cover the adapter, direct dependencies, and integrated verification. The implementation uses the standalone client, not the host-managed MCP route.

The adapter preserves the previous 60-second initialization budget. A separate setup guard also covers the initialized-notification POST. A shared close promise joins cleanup that the guard starts.

Tool calls retain the 15-second default and existing override normalization. Positive values are truncated and capped at the runtime timer limit. Invalid or nonpositive values retain the previous 60-second fallback instead of disabling the deadline.

The permanent transport tests use the real SDK with fake HTTP responses. The packed regression runs our actual installed `web_search` through a scripted mock model. It checks request and result mapping, unchanged schema, session termination, and absence of upstream tool registration.

Both the normal checkout and a fresh source copy pass the full 86-file, 671-test suite, zero-warning checks, and packing. The fresh copy uses frozen offline installation with scripts disabled and keeps its lockfile unchanged. The packed tool runs from read-only product files after an offline npm installation with an empty cache.

The build now bundles 184 modules instead of 453. The lockfile removes 29 obsolete records without changing retained versions or integrity values. Application bundles contain no mcporter or `@modelcontextprotocol/client` modules. Both producer layouts produce identical application payload bytes.

Independent read-only review reports no outstanding actionable findings. The reviewer also ran focused tests and a concurrency and streamed-response probe. Passing verification and review do not close TOOLS-30 or imply user acceptance.

The research recommended live-service evidence. Implementation verification uses isolated protocol fixtures and does not certify live Parallel availability. It covers the selected anonymous Streamable HTTP contract, not every legacy transport, authentication, or recording feature in mcporter.

## Source references

The findings use source and installed packages at research revision `cc55849f`:

- `extensions/web-search/src/parallel-adapter.ts:14–112`, `adapter-selection.ts:42–60`, and `tool-operation.ts:52–71` define the existing request and output path.
- `node_modules/mcporter/dist/runtime.js:17–24,168–200` and `runtime/http-transport.js:115–125,198–241` show configuration loading, call limits, and legacy transport fallback.
- `node_modules/@earendil-works/pi-mcp/dist/client.d.ts:11–20,39–46,67–68` and `transports/streamable-http.d.ts:26–35` define the public API.
- The native `dist/client.js:112–153,370–421` and `transports/streamable-http.js:174–215,227–279,401–461` define initialization, cancellation, and cleanup.
- `node_modules/@earendil-works/pi-coding-agent/docs/mcp.md:191–204,260–272` describes the separate host-managed route. Its `package.json:46` declares the existing native MCP dependency.
