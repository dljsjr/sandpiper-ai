---
title: "Investigate native MCP transport behind Sandpiper web tools"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-11-02T23:03:48.440Z
updated_at: 2026-11-03T01:50:56.436Z
related:
  - TOOLS-92
---

# Investigate native MCP transport behind Sandpiper web tools

## User acceptance and adoption authorization

Doug explicitly accepted the standalone-client direction and required it in the current overall simplification, not as a deferred candidate. Research is accepted. Implementation is now tracked by TOOLS-100/101/102 under30 and requires its own verification/review. Do not infer implementation acceptance from this research closure.

## Earlier investigation record

## Research delivery

Committed documentation-only research as ttrwrssm / cc55849f. Product main remains4abe9b67 and working copy is clean. Investigation is NEEDS REVIEW; no replacement implementation, dependency edit, live service call, push or release.

## Research result: feasible internal-client candidate, no adoption approval

Pi's standalone @earendil-works/pi-mcp1.3.0 can replace the mcporter client layer behind the existing web_search facade. Source correction: only Parallel's anonymous web_search fallback uses mcporter; web_fetch uses ordinary HTTP. No REST rewrite, tools/list, host MCP manager/configuration, automatic upstream tool registration or new public tool is needed. Existing parser/provider/output boundary stays. Native package is already shipped transitively, but adoption still needs explicit exact direct declarations and normal packaging verification. Developer mise mcporter CLI is separate and unchanged.

Explanation: .sandpiper/docs/specs/web-search-mcp-transport-investigation.md. Lead reviewed full temporary proof and repeated15 injected-fetch cases plus strict public-API signature typecheck on Bun1.4.4. Existing parser/selection baseline2files14tests also passes. Temp evidence /tmp/tools99-native-mcp.f3C1Rv/{probe.ts,api-check.ts,result.json}; fake .invalid addresses, guarded uninjected fetch, isolated HOME/XDG. No real upstream/provider calls, production/dependency/build-output edits, install, workspace build or pack.

Compatibility gates remain: actual Parallel Streamable HTTP/protocol support, loss of mcporter legacy HTTP+SSE fallback, exact15s tool-call bound versus connection setup, initialized-notification stall outside native request timeout, transport close after cancellation, best-effort1s session DELETE, malformed/error-result policy and current anonymous-auth behavior. Native is not a full-library drop-in replacement. Existing facade signal is not forwarded today; new user cancellation remains separate scope. Researcher native-mcp093cd11d85ba is closed. No replacement implementation ticket or code was created by assumption.

## Original approved investigation

User authorized investigation next, not replacement implementation. mcporter is an MCP client behind a Sandpiper-owned web-tool facade, not a substitute REST API. Trace current call sites and verify which tool uses it; compare pinned Pi1.3.0 MCP public APIs as an internal transport without exposing upstream tools, changing our tool contracts, requiring user MCP setup or reading real settings/credentials. Establish request/response, anonymous/auth, connection/timeout/cancellation/cleanup, config independence and package/bundle constraints. Use installed docs/types/source and hermetic localhost-only proof where useful; no live upstream calls, provider calls, production code edits, dependency changes or tool removals. Report recommendation, evidence, limits and genuinely open decisions before any adoption. Preserve standalone Trail bridge, disabled Shell Relay, developer tools, archives, WIP skills and accepted build/resource work.

---

# Activity Log

## 2026-11-02T23:03:54.811Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-02T23:22:36.576Z

- **description**: 1 line → updated (11 lines)

## 2026-11-02T23:22:36.638Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-02T23:24:43.101Z

- **description**: 11 lines → updated (15 lines)

## 2026-11-03T01:50:56.252Z

- **description**: 15 lines → updated (21 lines)

## 2026-11-03T01:50:56.437Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
