# AutoTOON Capability

Shared AutoTOON implementation for the Sandpiper runtime.

## Modules

| Module        | Description                                                                                |
| ------------- | ------------------------------------------------------------------------------------------ |
| `src/core.ts` | Host-neutral JSON→TOON transform constants and `tryConvertJsonToToon(...)`. No Pi imports. |

`extensions/autotoon/autotoon.ts` is the Pi adapter. It registers the `tool_result` hook and applies the core transform to text blocks.

## Commands

The package exposes source TypeScript without separate build output. From the repository root:

```bash
bun run test:vitest -- packages/capability-autotoon
bun run build  # Bundle the product, including AutoTOON source
```
