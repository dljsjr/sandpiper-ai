# CLI Development Guide

Guidelines for building command-line tools in the Sandpiper repository.

## Overview

This document describes architectural patterns and best practices for building CLI tools with Commander.js. These guidelines apply to all CLI packages in the repository, including `packages/cli/`.

## Core Principle: Separation of Concerns

The most important principle in CLI development is **decoupling implementation logic from argument parsing**.

### Why This Matters

When CLI argument parsing is mixed with implementation logic:

- **Testing becomes harder** — you need to mock the CLI framework or spawn subprocesses
- **Logic can't be reused** — implementation is tied to Commander objects
- **Changes ripple** — modifying argument parsing affects core logic

### The Pattern

Structure your CLI in two layers:

```
my-cli/
├── index.ts          # CLI entry point: Commander program (thin layer)
├── commands/
│   ├── create.ts     # Commander command wiring (thin layer)
│   └── list.ts       # Commander command wiring (thin layer)
├── core/
│   ├── create.ts     # Implementation logic (no Commander imports)
│   ├── create.test.ts
│   ├── list.ts       # Implementation logic (no Commander imports)
│   └── list.test.ts
└── test/
    └── cli.test.ts   # End-to-end CLI tests
```

**CLI Layer** (`index.ts`, `commands/`):

- Defines Commander programs and commands
- Parses arguments and options
- Validates input at the boundary
- Delegates to core implementation functions
- Formats output for display

**Core Layer** (`core/`):

- Accepts plain TypeScript arguments (not Commander objects)
- Contains all business logic
- Has no imports from Commander or CLI frameworks
- Fully unit-testable without mocking the CLI parser

### Example

**CLI Layer** (thin):

```typescript
// commands/create.ts
import { Command } from "@commander-js/extra-typings";
import { createProject } from "../core/create.js";

const createCommand = new Command("create")
  .description("Create a new project")
  .argument("<name>", "project name")
  .option("-t, --type <type>", "project type", "default")
  .action(async (name, options) => {
    // Parse and validate at the boundary
    const projectType = validateProjectType(options.type);

    // Delegate to core implementation
    await createProject(name, projectType);

    // Format output
    console.log(`Created project: ${name}`);
  });
```

**Core Layer** (no CLI dependencies):

```typescript
// core/create.ts
export async function createProject(
  name: string,
  type: ProjectType
): Promise<void> {
  // Implementation logic here
  // No Commander imports, no process.argv, no CLI-specific types
}
```

## Testing Strategy

Both layers need tests, but they test different things:

### Unit Tests (Core Layer)

Unit tests call implementation functions directly with plain arguments:

```typescript
// core/create.test.ts
import { describe, it, expect } from "vitest";
import { createProject } from "./create.js";

describe("createProject", () => {
  it("creates a project with the given name", async () => {
    await createProject("my-project", "default");
    // Assert file creation, config generation, etc.
  });
});
```

**What this catches:**

- Business logic bugs
- Edge cases in implementation
- File I/O errors
- Validation logic

### End-to-End Tests (CLI Layer)

E2E tests exercise the full CLI pathway:

```typescript
// test/cli.test.ts
import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";

describe("CLI", () => {
  it("parses arguments correctly", () => {
    const output = execSync(
      "bun packages/cli/bin/sandpiper-system-prompt --help",
      {
        encoding: "utf8",
      }
    );
    expect(output).toContain("Usage:");
  });

  it("handles invalid arguments", () => {
    expect(() => {
      execSync(
        "bun packages/cli/bin/sandpiper-system-prompt unexpected-prompt",
        {
          encoding: "utf8",
        }
      );
    }).toThrow();
  });
});
```

**What this catches:**

- Argument parsing bugs
- Option validation
- Output formatting
- Exit codes

### Why Both Are Required

| Test Type      | Catches                      | Misses                              |
| -------------- | ---------------------------- | ----------------------------------- |
| **Unit tests** | Logic bugs, edge cases       | Argument parsing, output formatting |
| **E2E tests**  | CLI pathway, user experience | Internal logic, edge cases          |

Unit tests alone miss argument parsing bugs. E2E tests alone are slower and harder to debug. **Both layers are required.**

## Build and local use

Build Sandpiper before using its bin launchers. Dependency installation does not build application output.

### Build Process

From the repository root:

```bash
bun run build
```

One Bun invocation writes both JavaScript entrypoints and shared chunks under root `dist/`. The stable launchers stay under `packages/cli/bin/`. The root product owns documentation and the license directly.

After building, run `bun pm pack --ignore-scripts --destination ./dist` from the root to create a tarball without publishing it. The `bun run pack:cli` alias builds before running this command.

## Tools and Conventions

### Commander.js

Sandpiper uses Commander.js for CLI argument parsing. Key conventions:

- Use `@commander-js/extra-typings` for type-safe command definitions
- Define commands in separate files under `commands/`
- Export commands for composition and testing
- Use `.action()` with async functions for async commands

### Bun

Bun is the preferred runtime for CLI development:

- Use `bun run` for scripts
- Use `bun run test:vitest -- <testpath>` for focused tests and `bun run test` for the full-suite Vitest gate
- Do not use bare `bun test` as a repo health signal; it invokes Bun's runner, not the configured Vitest suite
- Use `bun build` for bundling (when needed)
- Prefer Node.js built-ins over new runtime dependencies

### TypeScript

- Use `strict: true` in `tsconfig.json`
- No `any` types
- Use `interface` for object shapes
- Internal packages expose source TypeScript for runtime imports and type checking

## Examples in This Repository

| File                                       | Purpose                                    |
| ------------------------------------------ | ------------------------------------------ |
| `packages/cli/sandpiper_standalone.ts`     | Main Sandpiper CLI entry point             |
| `packages/cli/sandpiper_system_prompt.ts`  | Model-free system prompt diagnostic        |
| `packages/cli/system_prompt_diagnostic.ts` | Diagnostic SDK orchestration               |
| `package.json`                             | Root product metadata and both bin entries |

## Related Documentation

- [Pi extension development](./pi-extension-development.md) — Sandpiper's Pi integration surfaces
- [Build System](./build-system.md) — When CLI builds are required
