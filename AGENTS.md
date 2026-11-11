# Sandpiper Development Guidelines

This repository is the Sandpiper source tree: a Bun/Node monorepo for the local Sandpiper runtime, extensions, skills, prompts, themes, docs, and developer tooling.

## Start Here

- Work against a task. Use the installed `trail` CLI for this repository's task tracking; it is not part of the Sandpiper distribution. If no relevant task exists, create one before making changes. Use `trail --help` or an available task skill for command guidance.
- This is a jj repository. Use `jj`, not `git`, for version-control operations.
- Before working in a subdirectory for the first time, read its `README.md` and `AGENTS.md` if they exist.
- Read the relevant `.sandpiper/playbooks/*/index.md` before changing an area you have not already loaded this session.

## Core Invariants

- Edit source, not generated artifacts. Do not hand-edit `dist/` or package `dist/` output.
- Use Bun as the preferred runtime, package manager, and script runner.
- Run workspace installs from the repo root.
- Keep workspace dependency specifications consistent: no `catalog:` specs; root local dependencies use `workspace:*`; package-level internal and registry dependencies use exact versions; verify with `bun run check:deps`.
- Keep application code runtime-agnostic between Node and Bun unless the code is explicitly dev tooling.
- Keep extension entrypoints thin; put reusable logic in package-owned or extension-local framework-independent modules.
- Use `strict: true`; no `any`; no `@ts-ignore` / `@ts-expect-error` without explicit justification.
- Tests must not touch real user or installed production state (`~/.sandpiper`, `~/.pi`, installed shell integrations, real agent config).
- Do not create tasks for changes we believe _upstream_ should make. Record the finding in the related task or doc and move on. Tasks that track an already-filed upstream PR or issue we are genuinely blocked on are fine.
- YAAMS is adjacent tooling, not part of this monorepo yet. Keep repo guidance valid without YAAMS, identity-local memory databases, or persistent identity CWDs; continuity uses Journal when installed, the task tracker, inbox, and session logs.

## Routing

| Working on...                                                                                    | Read first                                                 |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Documentation, `README.md`, `AGENTS.md`, `.sandpiper/docs`, `.sandpiper/playbooks`, docs cleanup | `.sandpiper/playbooks/documentation/index.md`              |
| Build system, root product metadata, root `dist/` output, packing                                | `.sandpiper/playbooks/development/build.md`                |
| TypeScript, tests, linting, verification, code-health rules                                      | `.sandpiper/playbooks/development/typescript-and-tests.md` |
| Environment variables, config paths, `PI_*`, `SANDPIPER_*`                                       | `.sandpiper/playbooks/development/env-vars.md`             |
| CLI tools, Commander commands, package `bin` entries, bundled executables                        | `.sandpiper/playbooks/development/cli.md`                  |
| Pi extensions, lifecycle hooks, custom tools, TUI, providers, SDK integration                    | `.sandpiper/playbooks/development/pi-extensions.md`        |
| AutoTOON, JSON→TOON conversion, token optimization                                               | `.sandpiper/playbooks/features/autotoon.md`                |
| Journal, session continuity, session environment variables, concurrent sessions                  | `.sandpiper/playbooks/features/session-continuity.md`      |

## Verification

- `bun check` is the lint/typecheck gate and must be clean: zero errors, zero warnings. Biome only
  hard-fails on errors, so zero-warnings is discipline rather than enforcement. That is deliberate
  — do not change the gate to fail on warnings.
- Use `bun run test:vitest -- <testpath>` for focused Vitest runs.
- Use `bun run test` for the full Vitest gate.
- Only use safe auto-fixes; no suppressions without asking.

## Repository Map

| Path                    | Purpose                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| `docs/`                 | Public Sandpiper project docs: usage, concepts, contributor/maintainer guides, public reference |
| `.sandpiper/playbooks/` | Agent-operational project guidance and routing                                                  |
| `.sandpiper/docs/`      | Active internal specs, PRDs, design notes, and implementation plans                             |
| `.sandpiper/archive/`   | Historical, completed, superseded, or stale docs                                                |
| `extensions/`           | Sandpiper Pi extension source                                                                   |
| `packages/`             | CLI source modules and internal workspace packages                                              |
| `devtools/`             | Build regressions and isolated CLI/RPC integration tests                                        |

## Public Documentation

Use `docs/README.md` as the public docs index and `CONTRIBUTING.md` as the contributor entrypoint. Public docs should read naturally for humans while remaining precise enough for agents to use as references.
