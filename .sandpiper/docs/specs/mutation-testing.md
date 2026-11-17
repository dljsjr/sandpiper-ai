# Mutation Testing Setup Plan

- **Diátaxis mode**: How-to plan
- **Status**: Planned. StrykerJS is not installed, and AGENT-109 is not started.
- **Scope**: Sandpiper-specific mutation-testing workflow for the repository's TypeScript
- **Related task**: AGENT-109
- **Last updated**: 2026-11-17

## Summary

This document records the planned mutation-testing workflow for Sandpiper. The commands below are design targets, not current repo commands: StrykerJS is not installed, and no Stryker configuration exists yet.

For general methodology, use project testing guidance and the selected tool's documentation.

## Proposed Tooling

- **StrykerJS** for JavaScript/TypeScript mutation testing. Confirm that it runs under Bun before committing to it.
- **Vitest** as the test runner, through the root `vitest.config.ts`.
- One root Stryker configuration. The repository has one `package.json` and one Vitest configuration, so there are no packages to configure one by one. The configuration's `mutate` globs select the code, starting with `packages/core/src/`.

## Proposed Workflow

```bash
# Future target, not currently available: a root script
bun run test:mutation
```

Use mutation testing:

1. After completing a substantial feature or bug fix
2. Before merging changes in core logic with non-trivial branching
3. During test refactoring to verify that new tests catch meaningful defects
4. Periodically to identify test debt

## Interpreting Results

| Status        | Meaning                                                      |
| ------------- | ------------------------------------------------------------ |
| Killed        | A test caught the mutation                                   |
| Survived      | No test caught the mutation; investigate as a test gap first |
| No Coverage   | The mutated code was not executed by tests                   |
| Timeout       | The mutation caused a hang or very slow run                  |
| Compile Error | The mutation broke TypeScript/compilation                    |

Treat survived mutants as test gaps first, design smells second, and equivalent mutants last.

## Ratcheting Strategy

1. Run an initial baseline.
2. Set the threshold slightly below baseline.
3. Raise the threshold as tests improve.
4. Prioritize core logic, public APIs, and bug-prone edge cases.

## Future Implementation Notes

- Stryker starts Vitest itself, so give it the isolation that the root `test:vitest` script sets: `GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_SYSTEM=/dev/null`, and `JJ_CONFIG` pointing at `devtools/test-fixtures/jj-test-config.toml`. Tests must not touch real user state.
- Keep mutation testing out of `bun check` and `bun run test`. Run it on demand, as a periodic quality check rather than a per-commit gate.
- The repository has no CI. Decide whether to enforce a threshold after the first baseline.
- Document equivalent mutants explicitly when suppressions are unavoidable.
