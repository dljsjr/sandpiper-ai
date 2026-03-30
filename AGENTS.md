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

## Read-When-Needed Documentation

The following topics have detailed documentation in `docs/`. Read the relevant doc **before** working in that area:

| Topic | Doc | Read when... |
|-------|-----|-------------|
| Build system & distribution | [.sandpiper/docs/build-system.md](.sandpiper/docs/build-system.md) | Modifying build scripts, postinstall, package.json, or the dist assembly |
| Extension loading (jiti) | [.sandpiper/docs/extension-loading.md](.sandpiper/docs/extension-loading.md) | Creating extensions, debugging import failures, understanding jiti behavior |
| Pi API pitfalls | [.sandpiper/docs/pi-api-pitfalls.md](.sandpiper/docs/pi-api-pitfalls.md) | Working with pi's extension API (`getFlag`, `events`, `session_directory`, etc.) |
| Environment variables | [.sandpiper/docs/env-vars.md](.sandpiper/docs/env-vars.md) | Reading/writing env vars, understanding SANDPIPER_*/PI_* mirroring |
| TUI development | [.sandpiper/docs/tui-extension-patterns.md](.sandpiper/docs/tui-extension-patterns.md) | Building UI components, banners, widgets, or custom renderers in extensions |
| CLI development | [.sandpiper/docs/cli-development.md](.sandpiper/docs/cli-development.md) | Building command-line tools with Commander |

## Task Management

All coding work MUST be tracked against a task. Do not begin implementation without a task to reference. This applies to features, bugs, refactors, and any other code changes.

### When to Create Tasks

- Before starting any implementation work, ensure a task exists for it
- If a task doesn't exist, create one using the tasks skill helper scripts
- Bugs discovered during implementation get their own top-level `BUG` task (not a subtask)
- Reference task keys in commit messages (e.g., `Refs: TCL-1, TCL-3`)
- **Every task MUST have a description** unless the title is completely self-explanatory. Include enough context that a future agent session with no prior knowledge of the work can understand: what the problem is, what constraints exist, what approach was considered, and where to look for more context. A task with just a title is a continuity failure.

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
- **Tests MUST NOT read, write, or delete real user or installed production state** (`~/.sandpiper`, `~/.pi`, installed shell integrations, real agent config, etc.). Use temp directories, fixtures, or injected targets instead.
- **Parameterize the concrete resource under test, not a generic ancestor.** If the real seam is a shell integrations directory, inject that directory; do not introduce a `homedir` override just to reach it. If a parent location is already parameterized, reuse that route instead of adding nested overrides.
- **Prefer existing override mechanisms over new ad hoc test-only path knobs.** Reuse established env/config/Pi resolution paths (for example `resolveEnvVar('CODING_AGENT_DIR')` for the agent directory) before adding new parameters.
- **Edge cases are first-class test cases.** Shell quoting, special characters, empty inputs, large outputs, error conditions, and boundary values should all have dedicated tests.

### Dogfood-Driven Development for Tool Calls

When building agent tools (pi extension tools), prioritize getting to a **dogfoodable state** as early as possible — a minimal version the agent can actually call and observe. The agent's own experience using the tool is a uniquely valuable feedback signal that unit tests can't replicate.

- **Ship a callable tool early**, even if incomplete. A tool that spawns a process and returns its PID is more informative to work with than a fully-designed API that only exists in tests.
- **Use the tool in-session** to validate ergonomics: Is the output useful? Is the context cost reasonable? Does the parameterization make sense from the agent's perspective?
- **Iterate based on real usage**, not hypothetical scenarios. Buffer sizes, default parameters, output formatting — these are best tuned by the agent actually calling the tool during development.
- **TDD still applies** — write tests for the core logic. Dogfooding validates the tool *interface* and *integration*; tests validate the *implementation*.

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
