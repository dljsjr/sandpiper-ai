# Sandpiper Development Guidelines

This repository is the Sandpiper source tree: a Bun/Node repository for the Sandpiper CLI, its bundled Pi extensions, shared core modules, docs, and developer tooling.

## Start Here

- Work against a task. Use the installed `trail` CLI for this repository's task tracking; it is not part of the Sandpiper distribution. If no relevant task exists, create one before making changes. Use `trail --help` or an available task skill for command guidance.
- This is a jj repository. Use `jj`, not `git`, for version-control operations. Write commit subjects as `type(scope): Capitalized summary` and reference tasks with a `Refs: AGENT-123` trailer.
- Before working in a subdirectory for the first time, read its `README.md` and `AGENTS.md` if they exist.

## Core Invariants

- Edit source, not generated artifacts. Do not hand-edit root `dist/`.
- Use Bun as the runtime, package manager, and script runner. Keep one root `package.json` and `bun.lock`, and run installs from the repository root.
- Pin registry dependencies to exact versions. Import internal source modules by relative path, not workspace names or aliases.
- Keep application code runtime-agnostic between Node and Bun unless it is explicitly dev tooling.
- No `any`, and no `@ts-ignore` or `@ts-expect-error` without explicit justification.
- Tests must not touch real user or installed production state (`~/.sandpiper`, `~/.pi`, installed shell integrations, real agent config).
- Do not create tasks for changes we believe _upstream_ should make. Record the finding in the related task or doc and move on. A task that tracks an already-filed upstream PR or issue we are blocked on is fine.

## Routing

Before changing an area, read its playbook unless you have already read it this session.

| Working on...                                                                                     | Read first                                                         |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Documentation, `README.md`, `AGENTS.md`, `.sandpiper/docs`, `.sandpiper/playbooks`, docs cleanup  | `.sandpiper/playbooks/documentation/documentation-architecture.md` |
| Build system, root product metadata, root `dist/` output, packing, Pi version updates, `patches/` | `.sandpiper/playbooks/development/build.md`                        |
| TypeScript, tests, linting, verification, code-health rules                                       | `.sandpiper/playbooks/development/typescript-and-tests.md`         |
| Environment variables, config paths, `PI_*`, `SANDPIPER_*`                                        | `.sandpiper/playbooks/development/env-vars.md`                     |
| Pi extensions, lifecycle hooks, custom tools, TUI, providers, SDK integration                     | `.sandpiper/playbooks/development/pi-extensions.md`                |
| AutoTOON, JSON→TOON conversion, token optimization                                                | `.sandpiper/playbooks/features/autotoon.md`                        |
| Journal, session continuity, session environment variables, concurrent sessions                   | `.sandpiper/playbooks/features/session-continuity.md`              |

## Verification

- `bun check` runs TypeScript, Biome, Knip, and the Prettier Markdown check. It must finish with zero errors and zero warnings. Biome fails only on errors, so zero warnings is a discipline, not enforced; do not change the gate to fail on warnings.
- `bun run test` builds root `dist/`, then runs the full Vitest suite. Use `bun run test:vitest -- <testpath>` for focused runs. Do not use bare `bun test`: it runs Bun's test runner, not Vitest.
- Format edited Markdown with `bunx prettier <path> --write`.
- Apply only safe auto-fixes (`bun run check:biome-check --write`). Ask before adding a lint suppression.

## Repository Map

| Path                    | Purpose                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `CONTRIBUTING.md`       | Contributor entry point                                                              |
| `docs/`                 | Public docs: usage, concepts, contributor guides, reference. Index: `docs/README.md` |
| `packages/`             | CLI and shared core source modules                                                   |
| `extensions/`           | Bundled Pi extension source                                                          |
| `devtools/`             | Build regressions and isolated CLI/RPC integration tests                             |
| `.sandpiper/playbooks/` | Agent-operational project guidance                                                   |
| `.sandpiper/skills/`    | Project skills                                                                       |
| `.sandpiper/docs/`      | Active internal specs, PRDs, design notes, and implementation plans                  |
| `.sandpiper/archive/`   | Finished, superseded, or stale docs                                                  |
