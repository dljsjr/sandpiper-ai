---
title: "Add mutation testing quality gate"
status: NOT STARTED
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-04-28T18:37:46.057Z
updated_at: 2026-06-03T04:44:12.622Z
---

# Add mutation testing quality gate

# Add mutation testing to sandpiper-ai

## What

Set up StrykerJS (or equivalent) as a periodic test-quality gate for `~/git/sandpiper-ai/`.

## Why now

The 2026-04-06 code review of the `standup-concurrency-fix` bookmark uncovered a textbook fixture-coupling failure: the parser had 6/6 passing tests against a hand-constructed "legacy format" that didn't match any real legacy standup file in the wild. The code, the fixture, and the regex all agreed with each other and disagreed with reality. Running the binary against a real standup file caught it in one command.

Mutation testing would catch this whole class of bug at CI time instead of code-review time. The `mutation-testing` skill is currently silent on this project because the project has no mutation tooling installed, and the skill correctly refuses to bolt scaffolding onto existing projects mid-task. So the gap stays a gap until someone does a deliberate setup pass. This inbox item *is* that deliberate setup pass.

Full context in `~/.sandpiper/agent/inbox/standup-concurrency-fix-review.md` (specifically the discussion of B-1 and the parser test).

## Scope

- Pick a tool — StrykerJS is the obvious default for the TypeScript/Node side. Verify it works under bun and with vitest as the test runner before committing.
- Wire it into the workspace at the package level. `packages/sandpiper-tasks-cli/` is probably the best first target — it has the most established test suite and the most logic worth mutating. Once one package is wired, the pattern should generalize.
- Don't try to enable it everywhere at once. Add it as a periodic-quality gate, not a per-commit gate. Match YAAMS's `cargo mutants` cadence: run on demand and after subtask completion, not on every test invocation.
- Add a `bun run xmutants` (or similar) script alias that mirrors `cargo xmutants`.
- Document the setup in `.sandpiper/docs/` (create `mutation-testing.md` if it doesn't exist) with the same interpretation guidance as the YAAMS `rust-tdd-workflow` skill: survivors are test gaps first, design smells second, equivalent mutants last.

## Out of scope

- Don't try to retrofit mutation testing onto whatever the implementing agent is currently working on. Let them finish the standup-concurrency-fix work first.
- Don't try to chase a particular score on day one. The first run will produce a baseline; the goal is just to start ratcheting upward.
- Don't add it to the `mutation-testing` skill's "don't mess with scaffolding" rule — that rule is correct as a default and should stay. The exception is *deliberate setup work like this one*, not "any time the gap is annoying."

## Done when

- A `bun run xmutants` (or equivalent) command runs StrykerJS against at least one package and produces a report.
- A new `.sandpiper/docs/mutation-testing.md` documents how to run it, when to run it, and how to interpret survivors.
- The `mutation-testing` skill is updated *only* if needed — most likely it's already correct and just becomes applicable to sandpiper-ai once the tooling exists.
- Delete this inbox file.

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
