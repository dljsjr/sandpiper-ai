# Sandpiper Core

Shared core utilities used across sandpiper packages and extensions. Framework-independent — no pi imports.

## Modules

| Module | Description |
|--------|-------------|
| `migrate-pi-configs.ts` | Move/symlink pi config directories to sandpiper equivalents |
| `preflight.ts` | Preflight check registration system (via `pi.events` bus) |
| `install-shell-integrations.ts` | Copy shell integration scripts to `~/.sandpiper/shell-integrations/` |
| `paths.ts` | `displayPath()` — replace homedir prefix with `~` for user-facing output |

## Build

```bash
bun run build    # tsc --build (composite project, emits declarations)
bun run test     # vitest (17 tests)
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
