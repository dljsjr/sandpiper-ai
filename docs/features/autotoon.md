# AutoTOON — Token Pitch Correction for Your JSON

**Like Auto-Tune, but for tokens.** 🎤

AutoTOON automatically converts verbose JSON output from tools into [TOON (Token-Oriented Object Notation)](https://toonformat.dev), reducing token usage by **30–60%** for tabular data.

## What It Does

When you run commands that return JSON (like `curl`, `jq`, `npm ls --json`, `docker inspect`, etc.), AutoTOON:

1. **Intercepts** the JSON output automatically
2. **Converts** it to TOON format (lossless, compact encoding)
3. **Injects** the converted result into the conversation

You don't need to do anything — it happens automatically in the background.

## How to Recognize TOON Output

When you see `[TOON]` at the start of tool output, you're looking at converted data:

- **Objects** use indentation-based hierarchy (key-value pairs, one per line)
- **Arrays of uniform objects** use spreadsheet mode: column headers first, then tab-separated values
- **The data is 100% lossless** — same information, fewer tokens

## Do You Need to Output TOON?

**No.** Just read TOON output and respond normally. AutoTOON handles the conversion automatically.

## What Gets Converted

| Tool                                 | Example             | Converted?              |
| ------------------------------------ | ------------------- | ----------------------- |
| `bash` running `curl`                | API response bodies | ✅ Yes (if > 256 bytes) |
| `bash` running `jq`                  | Filtered JSON       | ✅ Yes (if > 256 bytes) |
| `bash` running `npm ls --json`       | Dependency trees    | ✅ Yes                  |
| `bash` running `docker inspect`      | Container metadata  | ✅ Yes                  |
| `bash` running `kubectl get -o json` | K8s resources       | ✅ Yes                  |
| `read` tool                          | JSON file contents  | ✅ Yes                  |
| `ls` / `find` / `grep`               | Plain text output   | ❌ No (not JSON)        |
| Any tool returning < 256 bytes JSON  | Small payloads      | ❌ No                   |
| Any tool returning error             | Error messages      | ❌ No (preserved as-is) |

## Benefits

- **Token efficiency**: 30–60% fewer tokens for tabular data
- **Cost reduction**: Lower API costs for large JSON responses
- **Context window**: More room for actual conversation
- **Speed**: Faster token generation = quicker responses
- **Automatic**: Zero configuration

## Technical Overview

AutoTOON intercepts the `tool_result` event, converts JSON to TOON when beneficial (256–100,000 bytes, actually shorter), and injects the result. It never touches error results.

**Implementation**: `packages/capability-autotoon/src/core.ts` and `packages/capability-autotoon/src/pi-extension.ts`  
**Legacy Pi package bridge**: `extensions/autotoon/autotoon.ts`  
**Guidance injection**: Deferred. AutoTOON currently performs conversion only.

## Related Documentation

- [TOON Format Specification](https://toonformat.dev)
- [AutoTOON architecture](autotoon-architecture.md) — Implementation details
