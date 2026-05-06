# Sandpiper Development Guidelines

This file is repo-specific guidance for the sandpiper-ai project. For area-specific detail, read focused docs in `.sandpiper/docs/` or the subdirectory's `README.md` / `AGENTS.md`.

## Repository Structure

This repository is a **Bun/Node.js monorepo** that emits generated Pi/npm, standalone app, and Claude plugin artifacts. The repository root is a workspace package, not the canonical Pi package manifest.

> **Maintenance note:** Update this table when adding new projects.

| Path | Type | Description |
| --- | --- | --- |
| `extensions/system/` | Pi Extension | Sandpiper identity, system prompt, capability guidance, reinforced guidance, migration, diagnostics |
| `extensions/shell-relay/` | Pi Extension | Shared terminal session between user and agent |
| `packages/resources/skills/sandpiper/` | First-party skills | Edit source here, not `dist/skills/` |
| `packages/resources/skills/third-party/` | Vendored skills | Do not edit |
| `packages/core/` | Shared Library | System prompt, migration, preflight checks, shell integration, path utilities |
| `packages/capability-autotoon/` | Shared Library + Pi adapter | AutoTOON JSON→TOON neutral transform and Pi event adapter |
| `packages/adapter-claude-code/` | Claude Adapter | Claude Code hooks/adapters over neutral Sandpiper capabilities |
| `packages/cli/` | Distributable Binary | Sandpiper CLI wrapper around pi-coding-agent |
| `packages/sandpiper-tasks-cli/` | Distributable Bundle | Task management CLI |
| `packages/resources/prompts/` | Prompt templates | |
| `packages/resources/themes/` | UI themes | |
| `devtools/` | Dev-only | Build, vendoring, and development utilities |

## Core Repo Invariants

- Before working in a subdirectory for the first time, read its `README.md` and `AGENTS.md` if they exist
- All coding work tracked against a task. Bugs get their own top-level `BUG` task. Reference task keys in commits
- Edit **source**, not generated or assembled artifacts
- Active agent-operational docs live in **`.sandpiper/docs/`**, historical material in **`.sandpiper/archive/`**
- Code review docs under **`.sandpiper/reviews/`** are scratch artifacts: delete them after the review is resolved; don't commit them unless the user explicitly asks
- Treat design docs and guidance docs as living artifacts: update in place, don't create new files when iterating on a plan or spec
- Use **Bun** as the preferred runtime, package manager, and script runner
- Run workspace installs from the repo root
- Application code should stay runtime-agnostic between Node and Bun unless the code is explicitly dev tooling

## Read-When-Needed Routing

Read the relevant focused doc **before** working in these areas:

| Topic | Doc | Read when... |
| --- | --- | --- |
| Build system & distribution | `docs/dev/build-system.md` | Modifying build scripts, `postinstall`, `package.json`, or dist assembly |
| Concurrent sessions | `.sandpiper/docs/specs/concurrent-sessions.md` | Working on standup CLI, PID file lifecycle, or multi-session concurrency |
| Pi extension development | `docs/dev/pi-dev-suite/` | Creating extensions, debugging imports, working with lifecycle hooks, `getFlag`, `pi.events`, or cross-extension behavior |
| Environment variables | `docs/dev/env-vars.md` | Reading/writing env vars or adding config-path resolution |
| CLI development | `docs/dev/cli-development.md` | Building command-line tools with Commander or changing bundled bins |
| AutoTOON | `.sandpiper/docs/autotoon-extension.md` | Working on JSON→TOON conversion, the autotoon extension, or token optimization |
| Task storage & VCS churn | `docs/features/tasks/storage-guide.md` | Changing task storage topology, `.sandpiper-tasks.json`, `tasks.version_control` config, `storage init/migrate/sync/push/pull` commands, or task index persistence |

## TypeScript & Architecture

- Use `strict: true`
- Do not use `any`
- Do not use `@ts-ignore` / `@ts-expect-error` without explicit justification
- Prefer `interface` for object shapes
- Use `readonly` where mutation is unnecessary
- Extension core logic in framework-independent TypeScript modules; Pi extension entrypoints are thin glue for tool registration and lifecycle wiring
- Do not use dynamic imports except for optional dependencies

## Testing, Linting, and Verification

### Testing

- Use **Vitest**
- Test-first. Reproduce bugs with a failing test before fixing
- Emphasize real behavior over mocks
- Treat edge cases as first-class test cases
- Tests must **not** touch real user or installed production state (`~/.sandpiper`, `~/.pi`, installed shell integrations, real agent config, etc.)
- Parameterize the **concrete resource under test**, not a generic ancestor like `homedir()`
- Prefer existing env/config resolution seams over inventing new test-only knobs
- Dogfood tool interfaces early; use tests to validate implementation details

### Linting

- Run `bun check` from the repo root — output must be clean: zero errors, zero warnings
- Run lints as frequently as tests
- Only use safe auto-fixes; no suppressions without asking

### Verification

- Verify against implementation and working examples, not docs alone
- Check real dist layout and package metadata before writing path-dependent code
- Prefer consistency with nearby code over inventing a new local style

## Paths and Serialization

### Path Handling

- Use `join()` to build paths
- Use `homedir()` for home-directory paths
- Use `resolve()` for absolute paths
- Do not manually expand `~`
- Match the path-handling style already used in the surrounding code

### Serialization

- Version serialized formats from day one; include migrations where data may evolve
- Prefer formats that are both human-readable and machine-parseable when practical

## User-Facing Documentation

| Audience | Location |
|----------|----------|
| **Users** (features, guides) | `docs/` — [`docs/README.md`](docs/README.md) |
| **Extension developers** | `.sandpiper/docs/pi-dev-suite/` |
| **Maintainers** (architecture, design) | `.sandpiper/docs/` |
