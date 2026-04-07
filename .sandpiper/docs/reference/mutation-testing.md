# Mutation Testing Setup Guide

**Status**: 📋 **PLANNED** - StrykerJS integration not yet implemented  
**Scope**: Sandpiper-specific workflow for packages/sandpiper-tasks-cli and other packages  
**Related skill**: `mutation-testing` (general methodology, all frameworks)  
**Last updated**: 2026-03-26  

---

## Summary

This document describes how to run mutation testing in the sandpiper-ai repository using StrykerJS. It complements the `mutation-testing` skill, which covers general methodology and all major frameworks (PIT, cargo-mutants, Stryker for JS/TS/.NET/Python/Scala).

**Implementation status**: The workflow and commands described here are not yet implemented. StrykerJS has not been added to the workspace, and no `stryker.config.json` files exist. This doc serves as a plan for future integration.

---


This document describes how to run mutation testing in the sandpiper-ai repository using StrykerJS.

## Overview

Mutation testing evaluates test quality by introducing small changes ("mutants") into the source code and verifying that tests fail. Surviving mutants indicate gaps in test coverage.

## Tooling

- **StrykerJS**: JavaScript/TypeScript mutation testing framework
- **Test runner**: Vitest (already configured in the workspace)

## Quick Start

```bash
# Run mutation testing on packages/sandpiper-tasks-cli
cd packages/sandpiper-tasks-cli
bun run xmutants
```

## Configuration

StrykerJS is configured per-package. See `packages/sandpiper-tasks-cli/stryker.config.json` for the baseline configuration.

### Key Configuration Options

- **mutate**: Glob patterns for files to mutate
- **testRunner**: `vitest` (configured to use bun)
- **reporters**: Progress, HTML, and dashboard (optional)
- **thresholds**: Minimum mutant score to pass (configurable per package)

## When to Run

Mutation testing is **not** run on every commit. Use it:

1. **After completing a subtask** — verify test quality before moving on
2. **Before merging significant changes** — ensure new code is well-tested
3. **On-demand during test refactoring** — validate that test improvements actually catch more mutants
4. **Periodically** — run against the full package to identify test debt

## Interpreting Results

### Mutant Status

- **Killed**: Test caught the mutation (good)
- **Survived**: No test caught the mutation (investigate)
- **No Coverage**: Mutant wasn't executed by any test (add tests)
- **Timeout**: Mutation caused test to hang (rare)
- **Compile Error**: Mutation broke compilation (expected for some mutants)

### Survivor Analysis

When a mutant survives, follow this decision tree:

1. **Is this a real test gap?** → Write a test that catches this mutation
2. **Is this an equivalent mutant?** → The mutation is semantically identical (document and ignore)
3. **Is this a design smell?** → The code is hard to test; consider refactoring

**Rule of thumb**: Survivors are test gaps first, design smells second, equivalent mutants last.

## Ratcheting Strategy

Don't try to achieve 100% mutant score on day one. Instead:

1. Run baseline to get current score
2. Set threshold slightly below baseline (e.g., baseline - 5%)
3. Gradually increase threshold as test quality improves
4. Focus on high-impact survivors first (core logic, edge cases)

## Integration with Workflow

### During Development

```bash
# After writing tests for a new feature
cd packages/sandpiper-tasks-cli
bun run xmutants

# Review survivors in the HTML report
open reports/mutation/html/index.html
```

### CI/CD (Future)

Mutation testing can be added to CI as a quality gate:

```yaml
# Example GitHub Actions step
- name: Mutation Testing
  run: bun run xmutants
  continue-on-error: true  # Don't block PRs initially
```

## Tips

1. **Start small**: Run against one package or module first
2. **Focus on survivors**: Don't try to kill every mutant immediately
3. **Use HTML reports**: Visual reports make it easier to understand survivor patterns
4. **Batch similar survivors**: If multiple survivors in the same function, write one comprehensive test
5. **Document equivalent mutants**: Add comments explaining why certain mutants are ignored

## Troubleshooting

### StrykerJS doesn't start

- Ensure `@stryker-mutator/vitest-runner` is installed
- Check that vitest configuration is compatible (Stryker may need its own config)

### Too many timeouts

- Increase timeout in stryker.config.json
- Check for infinite loops in mutation candidates

### Low mutant score

- This is expected initially — use it to identify test gaps
- Focus on high-value areas first (core logic, public APIs)

## Related Documentation

- [Mutation Testing Skill](../../skills/sandpiper/mutation-testing/SKILL.md)
- [TDD Skill](../../skills/sandpiper/test-driven-development/SKILL.md)
- [YAAMS Mutation Testing Workflow](https://github.com/yaams/yaams-rs/blob/main/docs/rust-tdd-workflow.md) (reference)

## Future Enhancements

- **Token counting heuristic**: Use actual token savings to make smarter convert/skip decisions
- **Per-tool opt-out**: Allow specific tools to be excluded from TOON conversion
- **Metrics logging**: Track conversion stats for cost analysis
- **Retroactive conversion**: Convert historical JSON in context window on cache misses
