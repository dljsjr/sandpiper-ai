---
name: toon
description: >-
  Convert structured data between JSON and TOON format using the TOON CLI. Use
  when the user mentions TOON, wants to convert JSON to a more token-efficient
  format, needs structured output prepared for another agent/LLM, wants to
  compact a JSON report before handoff, asks to decode a .toon file back to
  JSON, or says things like "pipe this to toon", "make this more token
  efficient", "convert this JSON report", or "use TOON for handoff".
---

# TOON

Use TOON when structured data will be handed to another agent/LLM or pasted back
into the conversation and token efficiency matters.

## Core commands

```bash
# Inspect CLI help
bunx @toon-format/cli --help

# Encode JSON -> TOON
bunx @toon-format/cli input.json --encode --keyFolding safe -o output.toon

# Decode TOON -> JSON
bunx @toon-format/cli input.toon --decode -o output.json
```

## Workflow

1. Keep the original structured artifact (`.json`) if it is useful for debugging.
2. If the artifact is meant for another agent/LLM, encode it to `.toon`.
3. Prefer `--keyFolding safe` for repetitive nested keys unless there is a reason not to.
4. Hand off / inspect the `.toon` file rather than the raw JSON.

## When the source is not already JSON

If the source is CSV or another structured format, first build a **focused JSON
summary** containing only the fields the next agent needs. Then encode that JSON to
TOON.

This is usually better than converting a raw, high-volume report wholesale.

## Optional stats

If you want to measure the savings out of curiosity, add `--stats`:

```bash
bunx @toon-format/cli input.json --encode --keyFolding safe --stats -o output.toon
```

`--stats` is optional; do not add it by default unless the user asks.

## Notes

- TOON is especially useful for nested, repetitive, key-heavy JSON.
- For small ad-hoc payloads, the savings may not matter.
- If a report is huge, summarize first, then convert.
