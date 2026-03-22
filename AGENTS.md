# Development Guidelines

## Repository Structure

This repository is a **Pi Package** — a bundle that can contain multiple extensions, skills, prompt templates, and themes for the pi coding agent. It also functions as a Bun/Node.js monorepo via `workspaces`.

### Pi Package Layout

The following top-level directories are Pi Package convention directories, auto-discovered by the pi framework:

| Directory | Purpose |
|-----------|---------|
| `extensions/` | Pi extensions (`.ts`/`.js` files that register tools, hooks, etc.) |
| `skills/` | Pi skills (`SKILL.md` folders and `.md` files) |
| `prompts/` | Prompt templates (`.md` files) |
| `themes/` | UI themes (`.json` files) |

These are declared in `package.json` under the `pi` key. See the [Pi Packages documentation](packages/cli/dist/docs/packages.md) for details.

### Shared Code & Tooling

| Directory | Purpose | Distributed? |
|-----------|---------|--------------|
| `packages/` | Shared libraries and distributable binaries (Bun workspaces). General-purpose code used by extensions, skills, or external consumers. NOT where extensions live. | Yes |
| `devtools/` | Development scripts and utilities. Helpful for development workflows but not part of the distribution. | No |

### Project Map

> **Maintenance note:** Update this table when adding new projects.

| Path | Type | Description |
|------|------|-------------|
| `extensions/shell-relay/` | Pi Extension | Shared terminal session between user and agent |
| `packages/cli/` | Distributable Binary | Sandpiper CLI tooling |
| `packages/core/` | Shared Library | Shared core utilities |
| `devtools/` | Dev-only | Development scripts and utilities |

### Project-Specific Guidelines

Each extension or library MAY have its own `AGENTS.md` with project-specific guidelines. Project-level guidelines supplement these repo-wide guidelines; in case of conflict, the project-level `AGENTS.md` takes precedence.

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

Common workflow tasks (check, build, test, etc.) SHOULD be defined as `scripts` in each package's `package.json`. This allows the root `package.json` to orchestrate them across all workspaces (e.g., `bun run --workspaces --if-present check`).

- **Simple tasks:** Define directly in `scripts` (e.g., `"check": "biome check ."`)
- **Complex tasks:** Implement as scripts in `devtools/` and reference them from `scripts` (e.g., `"release": "bun devtools/release.ts"`)

This keeps `package.json` readable while allowing complex logic to live in proper script files.

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

This repo uses **Biome** for formatting and linting, configured via `biome.json` at the repo root. **TypeScript** type checking uses `tsc --noEmit`, configured via the root `tsconfig.json`.

All lint and check commands are run from the **repo root** — not from individual packages:

```sh
bun check              # Run tsc + biome check (format + lint + import organization)
bun check:tsc          # TypeScript type checking only
bun check:biome-check  # Biome format + lint + import organization
bun check:biome-lint   # Biome lint rules only
bun check:biome-fmt    # Biome formatting only
bun check --write      # Apply biome auto-fixes in place
```

Do NOT run biome manually via `bunx` — always use the root `bun check` commands.

**Lint as frequently as you test.** Run `bun check` alongside test runs after every meaningful code change. Do not defer linting to a separate pass.

**Lint output MUST be totally clean.** Zero errors, zero warnings. If a warning appears, fix the underlying code — do not ignore it.

**Only use safe auto-fixes.** When running `bun check --write`, do NOT use `--unsafe`. Unsafe fixes (e.g., replacing `!` with `?.`) can change runtime semantics and break type checking. Fix unsafe diagnostics manually.

**Do NOT add lint suppression comments without consulting the user.** If you believe a lint warning is a false positive, explain the situation to the user and let them decide whether to suppress it. Never add `biome-ignore`, `// @ts-ignore`, `// @ts-expect-error`, or similar suppression comments on your own.

### Dependencies

- Prefer Node.js built-in modules over third-party packages
- External runtime dependencies MUST be justified — don't add a package for something achievable in a few lines of code
- `devDependencies` (test frameworks, type definitions, linters) are more acceptable than runtime `dependencies`
- Pi peer dependencies (`@mariozechner/pi-coding-agent`, `@sinclair/typebox`, etc.) go in `peerDependencies` with `"*"` range — do not bundle them

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

## Task Management

All coding work MUST be tracked against a task. Do not begin implementation without a task to reference. This applies to features, bugs, refactors, and any other code changes.

### When to Create Tasks

- Before starting any implementation work, ensure a task exists for it
- If a task doesn't exist, create one using the tasks skill helper scripts
- Bugs discovered during implementation get their own top-level `BUG` task (not a subtask)
- Reference task keys in commit messages (e.g., `Refs: TCL-1, TCL-3`)

### Project Key Guidelines

Each project key is 3 uppercase letters scoped to a logical product or component. Use these guidelines to decide whether work belongs in an existing project or a new one:

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
