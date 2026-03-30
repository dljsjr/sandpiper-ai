# CLI Development

Guidelines for building command-line tools with Commander (or similar frameworks).

## Separation of Concerns

- **Implementation logic MUST be decoupled from CLI argument parsing.** The CLI layer (Commander command definitions, argument parsing, option handling) is a thin entry point that delegates to framework-independent functions. This mirrors the same pattern used for pi extensions (see Architecture > Framework-Independent Core in AGENTS.md).
- Implementation functions accept plain TypeScript arguments — not Commander objects, not `process.argv`, not parsed option bags from the framework.
- This ensures core logic can be **unit tested directly** without invoking the CLI, mocking argument parsers, or spawning subprocesses.

## Testing Strategy

- **Unit tests** call the implementation functions directly with plain arguments. These are fast, reliable, and cover the core logic.
- **End-to-end tests** exercise the full CLI pathway — invoking the Commander program (or spawning the CLI as a subprocess) to validate that argument parsing, option handling, and output formatting work correctly together.
- Both layers are required. Unit tests alone miss argument parsing bugs; E2E tests alone are slow and make debugging failures harder.

## Example Structure

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
