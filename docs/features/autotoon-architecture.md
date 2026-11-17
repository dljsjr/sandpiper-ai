# AutoTOON architecture

AutoTOON converts qualifying JSON tool output to [TOON](https://toonformat.dev) before the output enters the model context. The goal is to preserve the information content of structured JSON while reducing token usage for tabular or uniform data.

AutoTOON currently does conversion only. It does not inject model guidance about TOON into the system prompt.

## Source layout

| Path                              | Purpose                                          |
| --------------------------------- | ------------------------------------------------ |
| `extensions/autotoon/core.ts`     | Host-neutral JSON→TOON transform source of truth |
| `extensions/autotoon/autotoon.ts` | Pi `tool_result` adapter                         |

## Conversion pipeline

When a tool result is available:

1. The Pi adapter receives the `tool_result` event and skips `read` results, error results, and nested tool calls.
2. AutoTOON inspects each text content block.
3. Fast-reject skips text that does not start with `{` or `[`.
4. Size gates skip payloads shorter than 256 characters or longer than 100,000 characters.
5. The payload is parsed as JSON.
6. The JSON is encoded as TOON.
7. The conversion is kept only if TOON is shorter than the original JSON.
8. Converted output is prefixed with `[TOON]\n`.

The `read` exemption preserves exact file text for edits. The adapter returns no patch, so Pi keeps all content blocks and result metadata unchanged.

When it converts a block, the adapter returns the new content together with the event's `structuredContent`. Returning the content alone would drop the structured result that Pi passes to codemode scripts.

## Size thresholds

| Constant         | Value   | Rationale                                                                     |
| ---------------- | ------- | ----------------------------------------------------------------------------- |
| `MIN_JSON_BYTES` | 256     | Smaller payloads rarely save enough tokens to justify the header              |
| `MAX_JSON_BYTES` | 100,000 | Avoids CPU work on very large payloads that are likely near truncation limits |

## Edge cases

| Case                   | Behavior                                               |
| ---------------------- | ------------------------------------------------------ |
| Mixed content blocks   | Each text block is considered independently            |
| JSON embedded in prose | Not converted; the whole text block must parse as JSON |
| TOON not shorter       | Original JSON is preserved                             |
| Truncated JSON         | Parse fails and original text is preserved             |
| Already-converted TOON | Not JSON, so it passes through unchanged               |

## Testing

```bash
bun run test:vitest -- extensions/autotoon
```

## Future work

- Reintroduce capability guidance if dynamic system-prompt sections return.
- Use token-aware savings instead of character length.
- Add per-tool opt-out configuration.
- Track conversion metrics.
