# Devtools

Build regressions and isolated runtime tests for this workspace.

## Build and package tests

The root product builds both entrypoints into root `dist/` with `bun run build`. Run `bun run pack:cli` from the repository root to build and pack. It uses ordinary `bun pm pack --ignore-scripts --destination ./dist`. The package includes root documentation, the license, and patched runtime dependencies directly.

The former production helpers `clean.ts`, `packCli.ts`, and `stageCliResources.ts` are retired. There is no recursive dependency cleaner, temporary pack directory, or resource staging step. Their removal does not remove the runtime test infrastructure.

`packedCli.test.ts` covers offline installation with scripts disabled and both commands in a read-only installation outside the checkout. Build regressions cover replacement of stale output.

## Integration tests

[`integration/`](./integration/) contains the headless CLI and remote procedure call (RPC) integration tests. They start real `pi` or `sandpiper` processes with mock providers and isolated configuration directories. The jj isolation fixture remains under `test-fixtures/`.

See [`integration/README.md`](./integration/README.md).
