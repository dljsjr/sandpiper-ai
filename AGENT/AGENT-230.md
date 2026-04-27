---
title: "Remove dead runtime system-prompt-mutation code (prefix-cache diet)"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-07-10T21:31:29.700Z
updated_at: 2026-07-10T21:31:30.071Z
---

# Remove dead runtime system-prompt-mutation code (prefix-cache diet)

Doug: any code with the ability to change the system prompt after the first turn of a session breaks prefix caching and was a mistake made before understanding how prompt caching works. The custom-system-prompt-builder mechanism (before_agent_start hook) stays -- it's the only place to customize the prompt and is needed to create the cached prompt on turn one. What's being removed is everything that could vary the prompt across turns within one session, plus dead scaffolding discovered while auditing it.

Removed (all confirmed to never reach the rendered prompt, or to have zero producers):
- SystemRuntimeState.startupContextPending / coldStartGuidancePending and their one-shot gating in packages/core/src/startup-prompt.ts (activeTaskContext/workingCopyContext were computed only on turn 1, blanked after -- the literal prompt-varies-across-turns bug)
- shouldStartWithColdStartGuidance() in packages/core/src/session-continuity.ts (now-unread, was write-only)
- SessionContinuityStartInput.reason and .entries (both only fed the removed cold-start-guidance check)
- packages/core/src/startup-context.ts deleted entirely (ProjectTrigger/IndexedTask/ActiveTaskContext/WorkingCopySummary types + all collect/format functions) -- zero callers outside the severed path, not even the standup CLI
- readSandpiperStandupContent/defaultRunStandupRead in startup-prompt.ts -- zero callers anywhere
- extensions/system/prompt-contributions.ts deleted entirely (SANDPIPER_PROMPT_CONTRIBUTION_CHANNEL/SandpiperPromptContributionCollector/applyPromptContributions) -- zero emitters anywhere in the codebase, pure dead scaffolding
- 5 unused fields on SandpiperSystemPromptOptions in system-prompt.ts (activeTaskContext, workingCopyContext, coldStartGuidance, standupContent, projectTriggers) plus staticCapabilityGuidance, a 6th unrelated dead field found adjacent during the same pass
- registerStartupPromptHooks/registerSessionContinuityHooks signatures simplified accordingly (no more SystemRuntimeState param on the prompt hook, since it no longer needs it)

Explicit scope decision: project-routing-trigger injection (<available_projects> block, collectProjectTriggers/formatProjectTriggersForPrompt) is NOT being restored even though it's the same dead pattern -- Doug wants the system prompt smaller, not to add anything back. Corrected the tasks skill (packages/resources/skills/sandpiper/tasks/SKILL.md) which incorrectly claimed this happens automatically; it now instructs running `project list` manually.

Verified: check:tsc clean, check:biome-check clean on all touched files, all directly-affected test suites pass (session-continuity.test.ts, startup-prompt.test.ts, startup-hooks.test.ts, extension-factories.test.ts -- the last needed its hook-registration-order assertion updated). Full suite shows the same category of pre-existing devtools/distribution smoke-test flakiness that predates this session (confirmed via isolated re-runs).

---

# Activity Log

## 2026-07-10T21:31:29.806Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-07-10T21:31:30.073Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
