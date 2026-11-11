# AutoTOON — Token Pitch Correction for Your JSON

**Like Auto-Tune, but for tokens.** 🎤

AutoTOON automatically converts verbose JSON output from tools other than `read` into [TOON (Token-Oriented Object Notation)](https://toonformat.dev), reducing token usage for tabular data.

## What It Does

When you run commands that return JSON (like `curl`, `jq`, `npm ls --json`, `docker inspect`, etc.), AutoTOON:

1. **Intercepts** the JSON output automatically
2. **Converts** it to TOON format (lossless, compact encoding)
3. **Injects** the converted result into the conversation

You don't need to do anything — it happens automatically in the background.

## How to Recognize TOON Output

When you see `[TOON]` at the start of tool output, you're looking at converted data:

- **Objects** use indentation-based hierarchy (key-value pairs, one per line)
- **Arrays of uniform objects** use spreadsheet mode: column headers first, then comma-separated values
- **The data is 100% lossless** — same information, fewer tokens

## Do You Need to Output TOON?

**No.** Just read TOON output and respond normally. AutoTOON handles the conversion automatically.

## What Gets Converted

| Tool                                 | Example             | Converted?              |
| ------------------------------------ | ------------------- | ----------------------- |
| `bash` running `curl`                | API response bodies | ✅ Yes (if ≥ 256 chars) |
| `bash` running `jq`                  | Filtered JSON       | ✅ Yes (if ≥ 256 chars) |
| `bash` running `npm ls --json`       | Dependency trees    | ✅ Yes                  |
| `bash` running `docker inspect`      | Container metadata  | ✅ Yes                  |
| `bash` running `kubectl get -o json` | K8s resources       | ✅ Yes                  |
| `read` tool                          | JSON file contents  | ❌ No (preserved as-is) |
| `ls` / `find` / `grep`               | Plain text output   | ❌ No (not JSON)        |
| Any tool returning < 256 chars JSON  | Small payloads      | ❌ No                   |
| Any tool returning error             | Error messages      | ❌ No (preserved as-is) |

## Benefits

- **Token efficiency**: Fewer tokens for tabular data
- **Cost reduction**: Lower API costs for large JSON responses
- **Context window**: More room for actual conversation
- **Speed**: Faster token generation = quicker responses
- **Automatic**: Zero configuration

## Technical Overview

AutoTOON intercepts the `tool_result` event and converts JSON to TOON when beneficial (256–100,000 characters, and only when the result is shorter). It leaves `read` results unchanged so that the model can copy exact file text for edits. Error results and nested tool calls also remain unchanged.

**Implementation**: `extensions/autotoon/core.ts`  
**Pi adapter**: `extensions/autotoon/autotoon.ts`  
**Guidance injection**: Deferred. AutoTOON currently performs conversion only.

## Related Documentation

- [TOON Format Specification](https://toonformat.dev)
- [AutoTOON architecture](autotoon-architecture.md) — Implementation details
