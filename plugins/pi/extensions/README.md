# Neutral Pi Extension Adapters

Thin Pi adapters for neutral Sandpiper capabilities. These files are provider-surface routers, not implementation owners: edit source logic in `packages/*` or the existing compatibility extension modules they re-export from.

- `capabilities.ts` registers neutral background-process capabilities from `extensions/system/neutral-capability-extension.ts`.
- `shell-relay.ts` exposes the shared terminal relay extension from `extensions/shell-relay/`.
- `web-fetch.ts` exposes the web fetch tool extension from `extensions/web-fetch/`.
- `autotoon.ts` exposes the AutoTOON Pi lifecycle adapter from `packages/capability-autotoon/`.

Do not add Sandpiper identity, migration, startup prompt, diagnostics, or update behavior here.
