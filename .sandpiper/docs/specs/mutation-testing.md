# Mutation Testing Setup Plan

- **Diátaxis mode**: How-to plan
- **Status**: Planned — StrykerJS integration is not implemented yet
- **Scope**: Sandpiper-specific mutation-testing workflow for TypeScript packages
- **Related task**: AGENT-109
- **Last updated**: 2026-05-07

## Summary

This document records the planned mutation-testing workflow for Sandpiper. The commands below are design targets, not current repo commands: StrykerJS is not installed, and no `stryker.config.json` files exist yet.

For general methodology, use project testing guidance and the selected tool's documentation.

## Proposed Tooling

- **StrykerJS** for JavaScript/TypeScript mutation testing
- **Vitest** as the test runner
- Per-package Stryker configuration, starting with high-value core packages

## Proposed Workflow

```bash
# Future target, not currently available
cd packages/core
bun run xmutants
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

- Add package-local Stryker configs.
- Keep mutation testing out of the default fast check path initially.
- Add CI as a reporting gate before making it blocking.
- Document equivalent mutants explicitly when suppressions are unavoidable.
