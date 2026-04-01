# Development Guidelines

## How to Use This File

This root `AGENTS.md` is the repo's **hot-memory guidance**: global invariants, routing, and sources of truth. It should stay concise.

When you need area-specific detail:

1. Read the relevant focused doc in `.sandpiper/docs/`
2. Read the local `README.md` / `AGENTS.md` in the subdirectory you are touching
3. Prefer current source-of-truth docs over historical material in `.sandpiper/archive/`

If you change the guidance structure itself (`AGENTS.md`, focused docs, prompt templates, or deterministic-guidance plans), read:
- `.sandpiper/docs/agent-guidance-evolution.md`

## Repository Structure

This repository is a **Pi Package** and a Bun/Node.js monorepo.

### Pi Package Layout

| Directory | Purpose |
| --- | --- |
| `extensions/` | Pi extensions (`.ts` / `.js` files that register tools, hooks, etc.) |
| `skills/sandpiper/` | First-party skills |
| `skills/third-party/` | Vendored third-party skills |
| `prompts/` | Prompt templates |
| `themes/` | UI themes |

### Shared Code & Tooling

| Directory | Purpose | Distributed? |
| --- | --- | --- |
| `packages/` | Shared libraries and distributable binaries | Yes |
| `devtools/` | Development scripts and utilities | No |

### Project Map

> **Maintenance note:** Update this table when adding new projects.

| Path | Type | Description |
| --- | --- | --- |
| `extensions/system.ts` | Pi Extension | Sandpiper identity, update notifications, migration flags, diagnostics |
| `extensions/shell-relay/` | Pi Extension | Shared terminal session between user and agent |
| `packages/sandpiper-tasks-cli/` | Distributable Bundle | Task management CLI |
| `packages/cli/` | Distributable Binary | Sandpiper CLI wrapper around pi-coding-agent |
| `packages/core/` | Shared Library | Migration, preflight checks, shell integration installer, path utilities |
| `devtools/` | Dev-only | Build, vendoring, and development utilities |

## Core Repo Invariants

### Read Local Docs Before Editing New Areas

Before working in a subdirectory for the first time in a session, read that directory's `README.md` and `AGENTS.md` if they exist.

### Version Control

- Use **`jj`**, not `git`
- Prefer `jj commit -m "msg"` over `jj describe` + `jj new` when finishing a unit of work
- Prefer fixups (`jj squash`, `jj absorb`) over stray cleanup commits
- Curate history into logical commits before finishing a work session

### Task Management

All coding work must be tracked against a task.

- Use the **`sandpiper-tasks` CLI**, not direct task file edits
- Ensure a task exists before implementation
- Bugs discovered during implementation get their own top-level `BUG` task
- Every task must have a description rich enough for a cold-start future session
- Reference task keys in commit messages
- Keep task statuses current as work progresses

### Source of Truth

- Edit **source**, not generated or assembled artifacts
- Active agent-operational docs live in **`.sandpiper/docs/`**
- Historical material lives in **`.sandpiper/archive/`**
- Treat design docs and guidance docs as living artifacts: update them as decisions are made, deduplicate aggressively, and do consistency sweeps after significant edits

### Runtime & Tooling

- Use **Bun** as the preferred runtime, package manager, and script runner
- Run workspace installs from the repo root
- Prefer Node built-ins over new runtime dependencies
- Application code should stay runtime-agnostic unless the code is explicitly dev tooling

## Read-When-Needed Routing

Read the relevant focused doc **before** working in these areas:

| Topic | Doc | Read when... |
| --- | --- | --- |
| Agent guidance evolution | `.sandpiper/docs/agent-guidance-evolution.md` | Revising `AGENTS.md`, prompt templates, guidance docs, or planning deterministic guidance |
| Build system & distribution | `.sandpiper/docs/build-system.md` | Modifying build scripts, `postinstall`, `package.json`, or dist assembly |
| Extension loading | `.sandpiper/docs/extension-loading.md` | Creating extensions, debugging imports, or reasoning about source-loaded extensions |
| Pi API pitfalls | `.sandpiper/docs/pi-api-pitfalls.md` | Working with extension lifecycle hooks, `getFlag`, `pi.events`, or cross-extension behavior |
| Environment variables | `.sandpiper/docs/env-vars.md` | Reading/writing env vars or adding config-path resolution |
| TUI development | `.sandpiper/docs/tui-extension-patterns.md` | Building widgets, banners, or extension UI |
| CLI development | `.sandpiper/docs/cli-development.md` | Building command-line tools with Commander or changing bundled bins |
| Task storage & VCS churn | `.sandpiper/docs/task-storage-strategy.md`, `.sandpiper/docs/task-storage-implementation-plan.md`, `packages/sandpiper-tasks-cli/STORAGE.md` | Changing task storage topology, `.sandpiper-tasks.json`, `tasks.version_control` config, `storage init/migrate/sync/push/pull` commands, bootstrap/sync flows, or task index persistence |

## TypeScript

- Use `strict: true`
- Do not use `any`
- Do not use `@ts-ignore` / `@ts-expect-error` without explicit justification
- Prefer `interface` for object shapes
- Use `readonly` where mutation is unnecessary

## Testing, Linting, and Verification

### Testing

- Use **Vitest**
- Follow a test-first approach where practical
- Emphasize real behavior over mocks when practical
- Reproduce bugs with a failing test before fixing them
- Treat edge cases as first-class test cases
- Tests must **not** touch real user or installed production state (`~/.sandpiper`, `~/.pi`, installed shell integrations, real agent config, etc.)
- Parameterize the **concrete resource under test**, not a generic ancestor like `homedir()`
- Prefer existing env/config resolution seams over inventing new test-only knobs
- Dogfood tool interfaces early; use tests to validate implementation details

### Linting

- Run `bun check` from the repo root
- Lint output must be totally clean: zero errors, zero warnings
- Run lints as frequently as tests
- Only use safe auto-fixes; never use unsafe lint fixes without review
- Do not add lint suppression comments without consulting the user

### Verification

- Verify behavior against implementation and working examples, not docs alone
- Check real dist layout and package metadata before writing path-dependent code
- Prefer consistency with nearby code over inventing a new local style

## Architecture and Refactoring

### Framework-Independent Core

Extension core logic should live in framework-independent TypeScript modules. The Pi extension entrypoint should stay a thin glue layer for tool registration and lifecycle wiring.

### Refactoring Bias

- Extract shared patterns early
- Prefer argument passing over global state
- Prefer simplicity and readability over cleverness
- Replace dynamic imports / `require()` with top-level imports unless there is a compelling reason not to

## Paths and Serialization

### Path Handling

- Use `join()` to build paths
- Use `homedir()` for home-directory paths
- Use `resolve()` for absolute paths
- Do not manually expand `~`
- Match the path-handling style already used in the surrounding code

### Serialization

- Version serialized formats from day one
- Include migrations where serialized data may evolve
- Prefer formats that are both human-readable and machine-parseable when practical
