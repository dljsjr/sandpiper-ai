---
name: TypeScript, Tests, and Verification
read_when: writing TypeScript, changing tests, running checks, verification, linting, code quality, Vitest, Biome, strict TypeScript
---

# TypeScript, Tests, and Verification

## TypeScript Rules

- Use `strict: true` TypeScript.
- Do not use `any`.
- Do not use `@ts-ignore` or `@ts-expect-error` without explicit justification.
- Prefer `interface` for object shapes.
- Use `readonly` where mutation is unnecessary.
- Keep application code runtime-agnostic between Node and Bun unless the code is explicitly dev tooling.

## Testing Rules

- Use Vitest for tests.
- Test-first for bugs: reproduce with a failing test before fixing.
- Emphasize real behavior over mocks.
- Tests must not touch real user or installed production state (`~/.sandpiper`, `~/.pi`, installed shell integrations, real agent config).
- Parameterize the concrete resource under test, not a generic ancestor like `homedir()`.
- Prefer existing env/config resolution seams over test-only knobs.

## Verification Commands

| Need              | Command                                                          |
| ----------------- | ---------------------------------------------------------------- |
| Typecheck + lint  | `bun check`                                                      |
| Safe auto-fix     | `bun check --write`                                              |
| Focused Vitest    | `bun run test:vitest -- <testpath>`                              |
| Full suite        | `bun run test`                                                   |
| Structural rules  | `bun check:ast-grep`                                             |

`bun check` output must be clean: zero errors and zero warnings. Use targeted tests while developing, then run the appropriate gate for the touched area.
