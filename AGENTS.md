# Development Guidelines

## Repository Structure

This repository is a **Pi Package** — a bundle that can contain multiple extensions, skills, prompt templates, and themes for the pi coding agent. It also functions as a Bun/Node.js monorepo via `workspaces`.

### Pi Package Layout

The following top-level directories are Pi Package convention directories, declared in `package.json` under the `pi` key:

| Directory | Purpose |
|-----------|---------|
| `extensions/` | Pi extensions (`.ts`/`.js` files that register tools, hooks, etc.) |
| `skills/sandpiper/` | First-party skills (`SKILL.md` folders) |
| `skills/third-party/` | Vendored third-party skills (managed via `vendor.txt` + `bun vendor`) |
| `prompts/` | Prompt templates (`.md` files) |
| `themes/` | UI themes (`.json` files) |

See the [Pi Packages documentation](packages/cli/dist/docs/packages.md) for details.

### Shared Code & Tooling

| Directory | Purpose | Distributed? |
|-----------|---------|--------------|
| `packages/` | Shared libraries and distributable binaries (Bun workspaces). General-purpose code used by extensions, skills, or external consumers. NOT where extensions live. | Yes |
| `devtools/` | Development scripts and utilities. Helpful for development workflows but not part of the distribution. | No |

### Project Map

> **Maintenance note:** Update this table when adding new projects.

| Path | Type | Description |
|------|------|-------------|
| `extensions/system.ts` | Pi Extension | Sandpiper identity, update notifications, migration flags, preflight diagnostics |
| `extensions/shell-relay/` | Pi Extension | Shared terminal session between user and agent |
| `packages/sandpiper-tasks-cli/` | Distributable Bundle | Task management CLI (bundled to `skills/sandpiper/tasks/scripts/sandpiper-tasks`) |
| `packages/cli/` | Distributable Binary | Sandpiper CLI wrapper around pi-coding-agent |
| `packages/core/` | Shared Library | Migration, preflight checks, shell integration installer, path utilities |
| `devtools/` | Dev-only | Development scripts, vendoring tools, and build utilities |

### Project-Specific Guidelines

Each extension or library MAY have its own `AGENTS.md` with project-specific guidelines. Project-level guidelines supplement these repo-wide guidelines; in case of conflict, the project-level `AGENTS.md` takes precedence.

**Before working on files in a subdirectory for the first time in a session**, read that directory's `README.md` and `AGENTS.md` (if they exist) to understand the module's architecture, conventions, and testing patterns. Most directories have a `README.md` with descriptive context; some also have an `AGENTS.md` with prescriptive guidance specific to that module.

## Runtime & Toolchain

### Bun as CLI Tool

Use **Bun** as the preferred runtime, package manager, and script runner:

- `bun <file>` instead of `node <file>` or `ts-node <file>`
- `bun install` instead of `npm install` / `yarn install` / `pnpm install`
- `bun run <script>` instead of `npm run <script>`
- `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads `.env` — don't use dotenv.

### Monorepo Workflow

This repo uses Bun workspaces. Dependencies are managed from the **repo root**:

- Run `bun install` from the repo root to install all workspace dependencies.
- Individual packages/extensions can reference each other via `workspace:*` in `package.json`.
- Run workspace-scoped scripts via `bun run --filter <package> <script>` or `cd` into the project and run directly.

### Task Conventions

Common workflow tasks (build, test, etc.) SHOULD be defined as `scripts` in each package's `package.json`. The root `package.json` handles cross-cutting concerns like linting and type checking (see [Formatting & Linting](#formatting--linting)).

- **Package-level scripts:** `test`, `build`, `test:watch` — things specific to a single package
- **Root-level scripts:** `check`, `check:tsc`, `check:biome-*` — cross-cutting quality checks that run across all packages
- **Complex tasks:** Implement as scripts in `devtools/` and reference them from `scripts` (e.g., `"release": "bun devtools/release.ts"`)

### Code Portability

Application code SHOULD be runtime-agnostic — it should run on Node.js, Bun, or Deno without modification:

- Use standard Node.js built-in modules (`node:fs`, `node:net`, `node:child_process`, etc.) — not Bun-specific APIs
- Do NOT introduce native addons
- Bun-specific APIs are acceptable in build scripts, dev tooling, and repo configuration — not in application code

## TypeScript

- Use `strict: true` in `tsconfig.json`
- Do NOT use `any` — use `unknown` and narrow with type guards, or define proper types/interfaces
- Do NOT use `@ts-ignore` or `@ts-expect-error` — if absolutely unavoidable, add a comment explaining why
- Prefer `interface` over `type` for object shapes
- Use `readonly` where mutation is not needed

## Code Quality

### Formatting & Linting

This repo uses **Biome** for formatting and linting, configured via `biome.json` at the repo root. **TypeScript** type checking uses `tsc --noEmit`, configured via the root `tsconfig.json`. **ast-grep** provides structural code analysis rules, configured via `sgconfig.yml` with rules in `ast-grep/rules/`.

All lint and check commands are run from the **repo root** — not from individual packages:

```sh
bun check              # Run tsc + biome check (format + lint + import organization)
bun check:tsc          # TypeScript type checking only
bun check:biome-check  # Biome format + lint + import organization
bun check:biome-lint   # Biome lint rules only
bun check:biome-fmt    # Biome formatting only
bun check --write      # Apply biome auto-fixes in place
bun check:ast-grep     # Structural code analysis (ast-grep rules)
```

Do NOT run biome manually via `bunx` — always use the root `bun check` commands.

**Lint as frequently as you test.** Run `bun check` alongside test runs after every meaningful code change. Do not defer linting to a separate pass.

**Lint output MUST be totally clean.** Zero errors, zero warnings. If a warning appears, fix the underlying code — do not ignore it.

**Only use safe auto-fixes.** When running `bun check --write`, do NOT use `--unsafe`. Unsafe fixes (e.g., replacing `!` with `?.`) can change runtime semantics and break type checking. Fix unsafe diagnostics manually.

**Do NOT add lint suppression comments without consulting the user.** If you believe a lint warning is a false positive, explain the situation to the user and let them decide whether to suppress it. Never add `biome-ignore`, `// @ts-ignore`, `// @ts-expect-error`, or similar suppression comments on your own.

### Code Exploration with ast-grep

**Prefer ast-grep over grep/ripgrep** when the task involves understanding code *structure* rather than searching for plain text. ast-grep matches by AST, so it can answer questions like "find all exported functions," "which files import the pi framework," or "where are errors thrown" without false positives from comments, strings, or similarly-named variables.

Pre-built queries are in `ast-grep/queries/`:

```sh
# Map a module's public API
ast-grep scan --rule ast-grep/queries/find-exported-functions.yml extensions/shell-relay/

# Verify architecture boundaries (pi imports only in index.ts)
ast-grep scan --rule ast-grep/queries/find-pi-imports.yml extensions/

# Count test assertions in a package
ast-grep scan --rule ast-grep/queries/find-test-assertions.yml extensions/ 2>&1 | grep -c "┌─"

# Map error handling paths
ast-grep scan --rule ast-grep/queries/find-error-throws.yml packages/sandpiper-tasks-cli/
```

Pre-built transforms for refactoring are in `ast-grep/transforms/`. Always preview before applying (`-U` applies without confirmation):

```sh
# Preview: find interface props missing readonly
ast-grep scan --rule ast-grep/transforms/readonly-interface-props.yml extensions/
```

For one-off structural searches, use inline patterns:

```sh
# Find all calls to a specific function
ast-grep run -p 'updateTaskFields($$$ARGS)' -l ts packages/

# Find all async arrow functions
ast-grep run -p 'async ($$$PARAMS) => $$$BODY' -l ts extensions/
```

See `ast-grep/README.md` for the full catalog of queries, transforms, and rules.

### Dependencies

- Prefer Node.js built-in modules over third-party packages
- External runtime dependencies MUST be justified — don't add a package for something achievable in a few lines of code
- `devDependencies` (test frameworks, type definitions, linters) are more acceptable than runtime `dependencies`
- Pi peer dependencies (`@mariozechner/pi-coding-agent`, `@sinclair/typebox`, etc.) go in `peerDependencies` with `"*"` range — they are provided by pi's jiti runtime and MUST NOT be bundled into extensions

## Architecture

### Framework-Independent Core

The core logic of any extension MUST be implemented as pure TypeScript modules with **no framework dependencies** (no pi/sandpiper imports). This ensures the core can be:

- Executed and tested in isolation
- Unit tested without mocking the framework
- Reused outside the pi extension context if needed

The pi extension entry point (`index.ts`) should be a **thin glue layer** that registers tools, wires lifecycle hooks, and delegates all logic to framework-independent modules. Example:

```
my-extension/
├── index.ts          # Pi glue: tool registration, lifecycle hooks (thin)
├── core.ts           # Core logic (no pi imports)
├── external-api.ts   # External service wrapper (no pi imports)
└── ...
```

## Pi Extension API Pitfalls

Known issues and non-obvious behaviors in pi's extension API:

### `pi.getFlag()` uses bare names

Register and read flags **without** the `--` prefix:

```typescript
pi.registerFlag("my-flag", { type: "boolean" });
pi.getFlag("my-flag");     // ✅ returns the value
pi.getFlag("--my-flag");   // ❌ always returns undefined
```

The pi docs show `getFlag("--my-flag")` but this is incorrect. The plan-mode example and the implementation both use bare names. Flags are stored in `extension.flags` by the name passed to `registerFlag`.

### `session_directory` for CLI-only early-exit flags

Use `session_directory` (not `session_start`) for flags that perform an action and exit:

- Fires **after** flag values are populated (second arg parse pass)
- Fires **before** session manager is created — no session to clean up
- Can call `process.exit()` safely
- Receives only `event.cwd` — no `ctx` (no UI access)

### Module-level state is NOT shared across jiti instances

Each extension loaded by jiti gets its own module scope. A module-level array in `packages/core` will be a different instance in each extension. Use `pi.events` (the shared runtime event bus) for cross-extension communication instead.

### `pi.events` IS shared across extensions

`pi.events.on()` and `pi.events.emit()` are synchronous and work across all jiti-loaded extensions. Use this for patterns like preflight check collection where one extension emits and others respond.

### Cross-package TypeScript: use project references

When an extension imports from a workspace package (e.g., `sandpiper-ai-core`), use TypeScript project references instead of widening `rootDir`:

```json
// packages/core/tsconfig.json
{ "compilerOptions": { "composite": true, "declaration": true } }

// extensions/shell-relay/tsconfig.json
{ "references": [{ "path": "../../packages/core" }] }
```

The referenced package must be built first (`tsc --build`). Use conditional exports in `package.json` to serve types from `dist/` and source from `src/`:

```json
{ "exports": { ".": { "types": "./dist/index.d.ts", "default": "./src/index.ts" } } }
```

## Environment Variables

Sandpiper mirrors `PI_*` env vars into the `SANDPIPER_*` namespace (and vice versa) at startup via `pi_wrapper.ts`. This means users can set either `SANDPIPER_OFFLINE=1` or `PI_OFFLINE=1` and it works.

### Use `resolveEnvVar()` in our code

Always use `resolveEnvVar(name)` from `sandpiper-ai-core` to read env vars that exist in both namespaces. It checks `SANDPIPER_*` first, then falls back to `PI_*`:

```typescript
import { resolveEnvVar } from 'sandpiper-ai-core';

// ✅ Correct — checks SANDPIPER_OFFLINE, then PI_OFFLINE
if (resolveEnvVar('OFFLINE') === '1') { ... }

// ❌ Wrong — misses the SANDPIPER_* override
if (process.env.PI_OFFLINE === '1') { ... }
```

### Exempt variables

Four `PI_*` variables are exempt from mirroring and should be accessed directly via `process.env.PI_*`:

| Variable | Category | Purpose |
|----------|----------|---------|
| `PI_CODING_AGENT_PACKAGE` | Sandpiper internal | Path to the pi-coding-agent package (for self-improvement prompting, doc exploration) |
| `PI_CODING_AGENT_VERSION` | Sandpiper internal | Version of the underlying pi-coding-agent |
| `PI_PACKAGE_DIR` | Pi behavior control | Package directory pi loads extensions/skills from |
| `PI_SKIP_VERSION_CHECK` | Pi behavior control | Suppresses pi's built-in update check (sandpiper has its own) |

`resolveEnvVar()` handles these gracefully (short-circuits to the `PI_*` value), but prefer `process.env.PI_*` directly for clarity.

## TUI Development

When building or modifying TUI components for extensions, consult these resources **in this order**:

### Sandpiper Reference

| Resource | Path | Contents |
|----------|------|----------|
| TUI patterns doc | `.sandpiper/docs/tui-extension-patterns.md` | Practical patterns, decision guide, Pi internals analysis. **Read this first.** |
| System extension | `extensions/system.ts` | Working examples: `DynamicBorder` widgets, custom message renderers, theme usage |

### Pi Framework Reference

The Pi package is resolved via the `PI_CODING_AGENT_PACKAGE` env var. All paths below are relative to that root.

| Resource | Path | Contents |
|----------|------|----------|
| TUI docs | `docs/tui.md` | Component API, theming, custom components, overlays, keyboard input |
| Extension docs | `docs/extensions.md` | `sendMessage`, `registerMessageRenderer`, `setWidget`, lifecycle hooks |
| Extension examples | `examples/extensions/` | Working examples — especially `message-renderer.ts`, `preset.ts`, `tools.ts` |
| TUI component source | `../pi-tui/dist/` (sibling package) | `Text`, `Container`, `Spacer`, `Box`, etc. — read the `.js` when docs are ambiguous |
| Interactive mode source | `dist/modes/interactive/interactive-mode.js` | How Pi renders notifications, widgets, custom messages internally |

### Key Principle

**Trust working examples and source over docs when they conflict.** Pi's docs occasionally show incorrect API usage (e.g., `getFlag("--name")` vs the correct `getFlag("name")`). When in doubt, read the implementation.

## Task Management

All coding work MUST be tracked against a task. Do not begin implementation without a task to reference. This applies to features, bugs, refactors, and any other code changes.

### When to Create Tasks

- Before starting any implementation work, ensure a task exists for it
- If a task doesn't exist, create one using the tasks skill helper scripts
- Bugs discovered during implementation get their own top-level `BUG` task (not a subtask)
- Reference task keys in commit messages (e.g., `Refs: TCL-1, TCL-3`)

### Project Key Guidelines

Each project key is a short uppercase identifier (2+ letters, typically 3–4) scoped to a logical product or component. Use these guidelines to decide whether work belongs in an existing project or a new one:

- **Same project** if the work directly implements, extends, tests, or fixes something within that component's codebase and responsibility boundary
- **New project** if the work introduces a new tool, library, extension, or distinct deliverable — even if it's related to existing work
- **When in doubt**, prefer a new project. It's easy to reference across projects via `related` or `depends_on`, but splitting a project retroactively is tedious

Examples:
- Shell relay extension code, tests, and shell scripts → `SHR`
- A CLI tool for managing tasks (separate binary/package) → `TCL` (not `SHR`, even though SHR uses it)
- A shared library consumed by multiple extensions → its own project key
- A bug in the FIFO manager discovered while working on relay orchestration → `SHR` (same component), kind `BUG`

## CLI Development

When building command-line tools with Commander (or similar frameworks):

### Separation of Concerns

- **Implementation logic MUST be decoupled from CLI argument parsing.** The CLI layer (Commander command definitions, argument parsing, option handling) is a thin entry point that delegates to framework-independent functions. This mirrors the same pattern used for pi extensions (see [Architecture](#framework-independent-core)).
- Implementation functions accept plain TypeScript arguments — not Commander objects, not `process.argv`, not parsed option bags from the framework.
- This ensures core logic can be **unit tested directly** without invoking the CLI, mocking argument parsers, or spawning subprocesses.

### Testing Strategy

- **Unit tests** call the implementation functions directly with plain arguments. These are fast, reliable, and cover the core logic.
- **End-to-end tests** exercise the full CLI pathway — invoking the Commander program (or spawning the CLI as a subprocess) to validate that argument parsing, option handling, and output formatting work correctly together.
- Both layers are required. Unit tests alone miss argument parsing bugs; E2E tests alone are slow and make debugging failures harder.

### Example Structure

```
my-cli/
├── index.ts          # CLI entry point: Commander program definition (thin)
├── commands/
│   ├── create.ts     # Commander command wiring (thin)
│   └── list.ts       # Commander command wiring (thin)
├── core/
│   ├── create.ts     # Implementation logic (no Commander imports)
│   ├── create.test.ts
│   ├── list.ts       # Implementation logic (no Commander imports)
│   └── list.test.ts
└── test/
    └── cli.test.ts   # End-to-end CLI tests
```

## Testing

### Framework

Use **Vitest** as the test framework. It provides first-class TypeScript and ESM support, describe/it/expect, mocking, watch mode, and snapshot testing.

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("MyModule", () => {
  it("should do the thing", () => {
    expect(result).toBe(expected);
  });
});
```

```sh
bunx vitest              # Run all tests
bunx vitest --watch      # Watch mode
bunx vitest path/to/file # Run specific test file
```

### Strategy

- **Test-first approach (TDD/BDD):** Write tests before or alongside implementation, not as an afterthought.
- **Emphasize unit and integration tests over manual testing.** Manual testing is important for end-to-end validation, but the automated test suite should catch the vast majority of issues.
- **Test real behavior over mocks where practical.** Only mock at boundaries where real resources are unavailable or impractical in a test environment (e.g., external service APIs, framework internals).
- **Edge cases are first-class test cases.** Shell quoting, special characters, empty inputs, large outputs, error conditions, and boundary values should all have dedicated tests.

### Conventions

- Test files live alongside the modules they test: `foo.ts` → `foo.test.ts`
- Integration tests that require external resources go in `test/integration/`
- Test fixtures and helpers go in `test/helpers/`

## General Coding Guidelines

### Don't Duplicate Code

When the same logic appears in multiple places, extract it into a shared function. This applies to:
- Repeated calculations or transformations
- Duplicated path construction
- Copy-pasted error handling
- Similar validation logic

If you find yourself copying code, stop and extract it instead.

### Be Consistent

Consistency reduces cognitive load and prevents bugs. Within a codebase:

- **Use the same patterns everywhere** — if one function uses `join(homedir(), ...)` for paths, all functions should
- **Match existing style** — look at nearby code and follow its conventions
- **Don't mix approaches** — if a module uses runtime APIs for paths, don't add string literals elsewhere
- **Prefer explicit over implicit** — `join(homedir(), '.config')` is better than `'~/.config'`

When in doubt, look at similar code in the same module or project and match its approach.

### Use Top-Level Imports

Import all dependencies at the top of the file. Don't use inline imports inside functions unless there's a compelling reason (lazy loading, circular dependency avoidance, etc.).

```typescript
// Good
import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';

function doSomething() {
  mkdirSync(join(homedir(), '.config'), { recursive: true });
}

// Bad
function doSomething() {
  import('node:fs').then(({ mkdirSync }) => { ... }); // Unnecessary
}
```

## Path Handling

When working with filesystem paths, prefer runtime APIs over string manipulation:

- **Use `join()` to construct paths from segments** — handles path separators portably
- **Use `homedir()` from `node:os` for home directory** — don't use `~` in string literals
- **Use `resolve()` for absolute paths** — let the runtime handle expansion
- **Don't manually expand tildes** — `~` and `~user` are shell conventions, not filesystem paths. Pass paths through `resolve()` and let the OS handle them.
- **Be consistent within a codebase** — if one part uses `join(homedir(), '.config')`, don't use `'~/.config'` strings elsewhere

```typescript
// Good: portable, explicit
import { homedir } from 'node:os';
import { join } from 'node:path';
const configDir = join(homedir(), '.sandpiper');

// Bad: shell-specific, fragile
const configDir = '~/.sandpiper';
```
