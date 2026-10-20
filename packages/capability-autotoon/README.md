# AutoTOON Capability

Shared AutoTOON implementation for the Sandpiper runtime.

## Modules

| Module | Description |
| --- | --- |
| `src/core.ts` | Host-neutral JSON→TOON transform constants and `tryConvertJsonToToon(...)`. No Pi imports. |
| `src/pi-extension.ts` | Pi adapter that registers the `tool_result` hook and applies the core transform to text blocks. |

`extensions/autotoon/autotoon.ts` is the Pi extension entrypoint.

## Commands

```bash
bun --filter sandpiper-capability-autotoon test
bun --filter sandpiper-capability-autotoon build
```
