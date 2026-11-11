# Sandpiper Core

Shared core utilities used across Sandpiper CLI modules and extensions. Framework-independent — no pi imports.

## Modules

| Module                             | Description                                                                               |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| `background-process-capability.ts` | Host-neutral background process start/check/completion operations over `ProcessManager`   |
| `session-continuity.ts`            | Set `SANDPIPER_SESSION_ID` and `SANDPIPER_SESSION_FILE` for a session                     |
| `process-manager.ts`               | `ProcessManager` and `ManagedProcess`: spawn, track, and buffer output of child processes |
| `startup-prompt.ts`                | Assemble Sandpiper startup prompt context for the Pi adapter                              |
| `system-notification.ts`           | Format and send `<sandpiper_system_notification>` messages                                |
| `system-prompt.ts`                 | Build the Sandpiper system prompt blocks                                                  |
| `user-profile.ts`                  | Read `USER.md` from the agent directory                                                   |
| `utils.ts`                         | Small shared helpers (`withTimeout`, `errorMessage`, `isRecord`, session short IDs)       |
| `version-control.ts`               | Detect whether the working directory uses jj, git, or neither                             |

## Build

Core exposes source TypeScript. It does not emit separate JavaScript or declarations. From the repository root:

```bash
bun run build  # Bundle the product, including core source
bun run test:vitest -- packages/core
```

## Usage

Extensions import the owning source module by relative path:

```typescript
import { errorMessage } from '../../packages/core/src/utils.js';
```

Core has no package manifest or barrel. Runtime imports and type checking use the same source modules. Extensions do not need a generated core `dist/` directory.
