---
title: "Add mutation testing quality gate"
status: COMPLETE
resolution: WONTFIX
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-04-28T18:37:46.057Z
updated_at: 2026-11-19T18:58:29.576Z
---

# Add mutation testing quality gate

# Add mutation testing to sandpiper-ai

## What

Set up StrykerJS (or equivalent) as a periodic test-quality gate for `~/git/sandpiper-ai/`.

## Why now

The 2026-04-06 code review of the `standup-concurrency-fix` bookmark uncovered a textbook fixture-coupling failure: the parser had 6/6 passing tests against a hand-constructed "legacy format" that didn't match any real legacy standup file in the wild. The code, the fixture, and the regex all agreed with each other and disagreed with reality. Running the binary against a real standup file caught it in one command. (The standup helper has since been removed from the repository; the class of bug remains.)

Mutation testing would catch this whole class of bug when it runs instead of at code-review time. The project still has no mutation tooling installed, so the gap stays a gap until someone does a deliberate setup pass. This task *is* that deliberate setup pass.

The task was filed from `~/.sandpiper/agent/inbox/standup-concurrency-fix-review.md` (the discussion of B-1 and the parser test). That file is no longer in the inbox.

## Scope

- Pick a tool — StrykerJS is the obvious default for TypeScript. Verify it works under Bun and with Vitest as the test runner before committing.
- Use one root Stryker configuration. The repository has one root `package.json` and one root `vitest.config.ts` (with `legacy-root`, `core`, `web-fetch`, and `web-search` projects), so there is no per-package wiring. Select code with `mutate` globs, starting with `packages/core/src/`: host-neutral logic with an established test suite (prompt assembly and templates, process manager, system notifications). Widen the globs once the first area runs cleanly. (The original first target, `packages/sandpiper-tasks-cli/`, left the repository when the tasks CLI became the external `trail` CLI.)
- Give Stryker's Vitest runs the same isolation as the root `test:vitest` script: `GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_SYSTEM=/dev/null`, and `JJ_CONFIG` pointing at `devtools/test-fixtures/jj-test-config.toml`. Tests must not touch real user state.
- Don't try to enable it everywhere at once. Add it as a periodic-quality gate, not a per-commit gate, and keep it out of `bun check` and `bun run test`. Match YAAMS's `cargo mutants` cadence: run on demand and after subtask completion, not on every test invocation. The repository has no CI.
- Add a root script alias, `bun run test:mutation` (the name the plan proposes) or similar, mirroring `cargo xmutants`.
- `.sandpiper/docs/specs/mutation-testing.md` already holds the plan, with the same interpretation guidance as the YAAMS `rust-tdd-workflow` skill: survivors are test gaps first, design smells second, equivalent mutants last. Update it to describe the implemented setup.

## Out of scope

- Don't try to retrofit mutation testing onto unrelated work in progress.
- Don't try to chase a particular score on day one. The first run will produce a baseline; the goal is just to start ratcheting upward.
- Don't change the `mutation-testing` skill's "don't mess with scaffolding" rule — that rule is correct as a default and should stay. The exception is *deliberate setup work like this one*, not "any time the gap is annoying." The skill is no longer bundled with Sandpiper (TOOLS-79/82); it is kept, not auto-loaded, in the skills-incubator repository.

## Done when

- `bun run test:mutation` (or equivalent) runs StrykerJS against at least `packages/core/src/` and produces a report.
- `.sandpiper/docs/specs/mutation-testing.md` documents how to run it, when to run it, and how to interpret survivors.
- The `mutation-testing` skill is updated *only* if needed — most likely it's already correct and just becomes applicable to sandpiper-ai once the tooling exists.

## Closed in backlog triage (2026-11-19)

Its motivating bug (a fixture that did not match real files) is not what mutation testing catches; Doug agreed to close.

---

# Activity Log

## 2026-04-28T18:37:46.099Z

- **description**: added (34 lines)

## 2026-06-03T04:43:52.487Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → Huginn

## 2026-06-03T04:44:12.622Z

- **status**: IN PROGRESS → NOT STARTED
- **assignee**: Huginn → UNASSIGNED

## 2026-11-17T22:45:17.563Z

- **description**: updated

## 2026-11-19T18:58:28.690Z

- **description**: 34 lines → updated (38 lines)

## 2026-11-19T18:58:29.576Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: UNRESOLVED → WONTFIX
