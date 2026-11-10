# AutoTOON architecture

AutoTOON converts qualifying JSON tool output to [TOON](https://toonformat.dev) before the output enters the model context. The goal is to preserve the information content of structured JSON while reducing token usage for tabular or uniform data.

AutoTOON currently does conversion only. It does not inject model guidance about TOON into the system prompt.

## Source layout

| Path                                                         | Purpose                                          |
| ------------------------------------------------------------ | ------------------------------------------------ |
| `packages/capability-autotoon/src/core.ts`                   | Host-neutral JSON→TOON transform source of truth |
| `packages/capability-autotoon/src/pi-extension.ts`           | Pi `tool_result` adapter                         |
| `extensions/autotoon/autotoon.ts`                            | Pi extension entrypoint                          |

## Conversion pipeline

When a tool result is available:

1. The Pi adapter receives the `tool_result` event.
2. AutoTOON inspects each text content block.
3. Fast-reject skips text that does not start with `{` or `[`.
4. Size gates skip payloads smaller than 256 bytes or larger than 100,000 bytes.
5. The payload is parsed as JSON.
6. The JSON is encoded as TOON.
7. The conversion is kept only if TOON is shorter than the original JSON.
8. Converted output is prefixed with `[TOON]\n`.

Error results are left unchanged.

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
bun run test:vitest -- packages/capability-autotoon
bun run test:vitest -- extensions/autotoon/autotoon.test.ts
```

## Future work

- Reintroduce capability guidance if dynamic system-prompt sections return.
- Use token-aware savings instead of byte length.
- Add per-tool opt-out configuration.
- Track conversion metrics.
