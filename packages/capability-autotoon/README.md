# AutoTOON Capability

Shared AutoTOON implementation for the Sandpiper runtime.

## Modules

| Module                | Description                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| `src/core.ts`         | Host-neutral JSON→TOON transform constants and `tryConvertJsonToToon(...)`. No Pi imports.      |
| `src/pi-extension.ts` | Pi adapter that registers the `tool_result` hook and applies the core transform to text blocks. |

`extensions/autotoon/autotoon.ts` is the Pi extension entrypoint.

## Commands

The package exposes source TypeScript without separate build output. From the repository root:

```bash
bun run test:vitest -- packages/capability-autotoon
bun run build  # Bundle the product, including AutoTOON source
```
