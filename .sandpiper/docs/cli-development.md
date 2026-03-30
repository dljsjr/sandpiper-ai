# CLI Development

Read when: building or changing command-line tools, Commander wiring, bundled bins, CLI tests, or package build/install flow for a binary.
Last verified: 2026-03-30

## Key Rules

- Keep the CLI layer thin: argument parsing and command wiring belong in the entrypoint, not in core implementation logic.
- Core logic should accept plain TypeScript arguments and remain testable without Commander or subprocess spawning.
- Cover both layers: unit tests for implementation logic and end-to-end tests for real CLI parsing / output behavior.
- Use Bun for scripts, builds, and local invocation.
- If a CLI package emits a bundled binary or declarations, build that package first, then run `bash devtools/postinstall.sh`.

## Canonical Examples

- `packages/cli/pi_wrapper.ts`
- `packages/cli/package.json`
- `packages/sandpiper-tasks-cli/src/commands/project-cmd.ts`
- `packages/sandpiper-tasks-cli/src/core/project-metadata.ts`

## Reference

Guidelines for building command-line tools with Commander (or similar frameworks).

## Separation of Concerns

- **Implementation logic MUST be decoupled from CLI argument parsing.** The CLI layer (Commander command definitions, argument parsing, option handling) is a thin entry point that delegates to framework-independent functions. This mirrors the same pattern used for pi extensions.
- Implementation functions should accept plain TypeScript arguments — not Commander objects, not `process.argv`, and not framework-specific option bags.
- This keeps core logic unit-testable without invoking the CLI or mocking the argument parser.

## Testing Strategy

- **Unit tests** call the implementation functions directly with plain arguments.
- **End-to-end tests** exercise the full CLI pathway — invoking the Commander program or spawning the CLI as a subprocess — to validate argument parsing, option handling, and output formatting together.
- Both layers are required. Unit tests alone miss argument parsing bugs; E2E tests alone are slower and harder to debug.

## Example Structure

```text
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

## Related Docs

- [build-system.md](build-system.md) — when CLI package changes require build + postinstall
- [agent-guidance-evolution.md](agent-guidance-evolution.md) — planning doc for the current prompt-architecture revision
