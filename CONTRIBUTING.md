# Contributing to Sandpiper

Thanks for working on Sandpiper. This guide covers the local development workflow; feature and architecture details live in the docs linked below.

## Get the repo ready

```bash
git clone https://github.com/dljsjr/sandpiper-ai.git
cd sandpiper-ai
bun install
bun run build
```

Sandpiper uses Bun for package management and scripts. Run workspace installs from the repository root. Installation does not build generated output.

## Development checks

Use these commands while developing:

```bash
bun check                         # Type-check + lint
bun run test:vitest -- <testpath> # Focused Vitest run
bun run test                      # Full Vitest gate
```


Do not use bare `bun test` as the repository health gate; it invokes Bun's test runner, not the Vitest suite configured for this repo.

## Version control

This repository uses Jujutsu (`jj`). Use `jj` commands for local version-control operations even though the repository is Git-backed.

## Repository map

| Path                  | Purpose                                                                        |
| --------------------- | ------------------------------------------------------------------------------ |
| `docs/`               | Public Sandpiper documentation                                                 |
| `packages/`           | Workspace packages and package-owned build output                              |
| `extensions/`         | Sandpiper Pi extensions and compatibility entrypoints                          |
| `packages/resources/` | Shared skills, prompts, and themes                                             |
| `devtools/`           | Development-only build and project tooling                                     |
| `.sandpiper/`         | Project-local agent state, tasks, playbooks, active specs, notes, and archives |

## Useful docs

- [Documentation home](docs/README.md)
- [Build workflows](docs/dev/build-workflows.md)
- [Build system reference](docs/dev/build-system.md)
- [CLI development](docs/dev/cli-development.md)
- [Environment variables](docs/dev/env-vars.md)
- [Pi extension development](docs/dev/pi-extension-development.md)
- [Task management](docs/features/tasks/README.md)
- [Shell Relay](docs/features/shell-relay.md)
- [Directory layout](docs/concepts/directory-layout.md)

## Documentation changes

Documentation under `docs/` follows the [Diátaxis](https://diataxis.fr/) framework. A page should have a clear job: tutorial, how-to guide, reference, or explanation. If a page starts mixing jobs, split it and link between the pieces.

Keep public docs direct and natural. Agent-operational guidance belongs in `.sandpiper/playbooks/`; active internal specs and design notes belong in `.sandpiper/docs/`; completed or superseded material belongs in `.sandpiper/archive/`.

## Code style

- TypeScript with `strict: true`
- No `any`
- No `@ts-ignore` or `@ts-expect-error` without explicit justification
- Prefer `interface` for object shapes
- Use `readonly` where mutation is unnecessary
- Keep runtime code portable between Node and Bun unless it is explicitly dev tooling

Use safe auto-fixes when appropriate:

```bash
bun check --write
```

## Pull requests

1. Work against a focused task or issue.
2. Keep changes surgical.
3. Update docs when behavior changes.
4. Run the relevant checks and include them in the PR notes.
5. Mention task keys in commits or PR descriptions when applicable.
