# AutoTOON Capability

Package-first source for AutoTOON.

## Modules

| Module | Description |
| --- | --- |
| `src/core.ts` | Host-neutral JSON→TOON transform constants and `tryConvertJsonToToon(...)`. No Pi imports. |
| `src/pi-extension.ts` | Pi adapter that registers the `tool_result` hook and applies the core transform to text blocks. |

`extensions/autotoon/autotoon.ts` is a compatibility bridge for the legacy root Pi package path.

## Commands

```bash
bun --filter sandpiper-capability-autotoon test
bun --filter sandpiper-capability-autotoon build
```
