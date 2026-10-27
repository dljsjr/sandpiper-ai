# Sandpiper Core

Shared core utilities used across sandpiper packages and extensions. Framework-independent — no pi imports.

## Modules

| Module | Description |
|--------|-------------|
| `background-process-capability.ts` | Host-neutral background process start/check/completion operations over `ProcessManager` |
| `migrate-pi-configs.ts` | Move/symlink pi config directories to sandpiper equivalents |
| `migration-controls.ts` | Package-owned migration flag and `/migrate-pi` command operations |
| `preflight.ts` | Preflight check registration system (via `pi.events` bus) |
| `install-shell-integrations.ts` | Copy shell integration scripts to `~/.sandpiper/shell-integrations/` |
| `paths.ts` | `displayPath()` — replace homedir prefix with `~` for user-facing output |
| `session-continuity.ts` | Sandpiper session startup state, env vars, and PID file lifecycle operations |
| `startup-context.ts` | Collect compact startup prompt context (projects, active tasks, working-copy summary) |
| `startup-prompt.ts` | Assemble Sandpiper startup prompt context for the Pi adapter |
| `system-diagnostics.ts` | Package-owned diagnostics startup planning and update-check gating |
| `system-startup.ts` | Build host-neutral Sandpiper startup prompt sections and cold-start heuristics |
| `update-check.ts` | Check for pi update availability and install command suggestions |

## Build

```bash
bun run build    # tsc --build (composite project, emits declarations)
bun run test     # vitest
```

## Usage

Extensions import from `sandpiper-ai-core`:

```typescript
import { registerPreflightCheck, performMigration, displayPath } from 'sandpiper-ai-core';
```

This package uses `composite: true` in its tsconfig. Extensions that import from it should add a project reference:

```json
{ "references": [{ "path": "../../packages/core" }] }
```
