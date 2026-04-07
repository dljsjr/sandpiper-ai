# 🎤 AutoTOON

**Status**: Implemented (conversion-only)
**Last Updated**: 2026-04-20

## Overview

AutoTOON is Auto-Tune for your tokens. 🎤 Your JSON walks in, and TOON struts out. 🎶

It automatically converts JSON tool output to [TOON (Token-Oriented Object Notation)](https://toonformat.dev) before it enters the LLM context window, using 30–60% fewer tokens for tabular/uniform data.

## Scope

AutoTOON currently does **one** thing: intercept `tool_result` events and convert qualifying JSON text blocks to TOON.

It does **not** inject any system-prompt guidance about TOON — the model receives converted output without explicit instruction. This is a deliberate, temporary scope reduction: the prompt-injection plumbing was removed when the system-prompt assembly was refactored to drop dynamic sections. Re-introducing capability guidance is planned but unscheduled (will be revisited in a general capacity).

See `AGENT-51` for the original ticket and follow-ups for the deferred work.

## Architecture 🏗️

`extensions/autotoon/autotoon.ts` — single file, ~100 lines:

- `tryConvertJsonToToon(text)` — pure function: fast-reject → size gate → parse → encode → length-guard
- `default export(pi)` — registers a single `tool_result` handler that maps over content blocks

## How It Works 🎤

When a tool completes:

1. `tool_result` event fires
2. AutoTOON inspects each text block
3. Fast-reject: must start with `{` or `[`
4. Size gate: 256–100,000 bytes (Goldilocks zone)
5. Parse JSON → encode to TOON
6. Only convert if it's actually shorter
7. Slap on the `[TOON]` header and send it out 🎤

## Configuration

### Size Thresholds

| Constant | Value | Rationale |
|----------|-------|-----------|
| `MIN_JSON_BYTES` | 256 | Below this, token savings are negligible |
| `MAX_JSON_BYTES` | 100,000 | Prevents CPU waste on near-limit payloads |

### TOON Header

Converted output is prefixed with `[TOON]\n` to help the LLM (and humans) identify converted output in transcripts.

## What Gets Converted

| Tool | Typical JSON Output | Converted? |
|------|---------------------|------------|
| `bash` running `curl` | API response bodies | ✅ Yes |
| `bash` running `jq` | Filtered JSON | ✅ Yes (if > 256 bytes) |
| `bash` running `npm ls --json` | Dependency trees | ✅ Yes |
| `bash` running `docker inspect` | Container metadata | ✅ Yes |
| `bash` running `kubectl get -o json` | K8s resources | ✅ Yes |
| `bash` running `cat package.json` | Package manifest | ✅ Yes |
| `read` tool | File contents (if JSON) | ✅ Yes |
| `ls` / `find` / `grep` | Plain text output | ❌ No (not JSON) |
| Custom extension tools | If they return JSON text blocks | ✅ Yes |
| Any tool returning < 256 bytes JSON | Small payloads | ❌ No (below threshold) |
| Any tool returning error | Error messages | ❌ No (isError guard) |

## Edge Cases

1. **Mixed content blocks**: Only text blocks are inspected; each converted independently
2. **JSON embedded in non-JSON text**: Whole output must parse as JSON (no partial conversion)
3. **TOON larger than JSON**: Length guard prevents conversion if no net savings
4. **Pi's 50 KB truncation**: Event fires after truncation; invalid JSON passes through unchanged
5. **Double conversion**: TOON is not valid JSON, so already-converted output passes through

## Testing

```bash
bun x vitest run extensions/autotoon/autotoon.test.ts
bun x vitest run extensions/autotoon/autotoon-integration.test.ts
```

## Future Enhancements

- **System-prompt guidance**: re-introduce capability-guidance registration once dynamic system-prompt sections are reintegrated (pending general design work)
- **Token counting heuristic**: Use actual token savings instead of byte length
- **Per-tool opt-out**: Allow specific tools to be excluded via configuration
- **Metrics logging**: Track conversion stats for cost analysis

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Hook point | `tool_result` event | Middleware chain, minimal invasiveness, fires for all tools |
| JSON detection | `JSON.parse` with fast-reject | Reliable; no regex false positives |
| Size threshold | 256 bytes minimum | Below this, < 10 tokens saved — not worth header overhead |
| Length guard | Skip if TOON ≥ JSON length | Prevents regressions on nested/non-uniform structures |
| Error passthrough | Skip `isError: true` | LLM needs raw error text for diagnostics |
| TOON header | `[TOON]\n` prefix | Helps LLM/humans identify converted output |
| Prompt injection | **Deferred** | Removed when SP refactor dropped dynamic sections; will revisit |

## Related Documentation

- [TOON Format Spec](https://toonformat.dev) — Official format documentation
