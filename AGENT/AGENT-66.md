---
title: "AutoTOON: re-introduce capability guidance / system-prompt injection"
status: NOT STARTED
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-04-21T03:48:06.716Z
updated_at: 2026-06-03T04:44:12.690Z
related:
  - AGENT-51
---

# AutoTOON: re-introduce capability guidance / system-prompt injection

AutoTOON's prompt-injection half (capability-guidance-registry + AUTOTOON_SYSTEM_GUIDANCE block) was stripped on 2026-04-20 because the SP refactor (mputnknv) dropped all dynamic system-prompt sections, leaving the registry plumbing as dead-end code.

Current state on feat/autotoon (txrxmuno):
- AutoTOON does conversion only (tool_result interception → JSON→TOON)
- No system-prompt guidance about TOON is injected
- Model receives converted output without explicit instruction

To revisit: design a general capability-guidance reintegration alongside the broader 'dynamic sections reintegration' work tracked in standup. When that's done, restore:
- An emit of capability_guidance:register_static (or whatever the new contract is) from extensions/autotoon/autotoon.ts
- An AUTOTOON_SYSTEM_GUIDANCE block describing TOON to the model
- Wiring through buildSandpiperSystemPrompt in packages/core/src/system-prompt.ts (currently has a declared-but-unused staticCapabilityGuidance option)

## Folded review context

The following review notes were folded from inbox files before deleting them from `~/.sandpiper/agent/inbox/`.

### Round 1 summary

Initial AutoTOON review found that the JSON→TOON conversion path was small, clear, and tested, but prompt-side capability guidance relied on cross-extension shared module state. That conflicted with Sandpiper's jiti/extension-loading model, where each extension gets its own module scope. The required direction was system-owned state plus `pi.events` registration, with tests for register/upsert/unregister/no-registration behavior. The same review also flagged stale docs after the TOON → AutoTOON rebrand.

### Round 2 summary

Follow-up review found the round-1 blockers effectively resolved:
- capability guidance moved to a `pi.events` contract with system-owned state
- stale rebrand docs were mostly cleaned up
- `as any` warnings in tests were removed
- checks and targeted tests were clean

Remaining non-blocking notes from round 2:
- `.sandpiper/docs/autotoon-extension.md` still showed an old `registerStaticCapabilityGuidance` import/snippet; update to the `pi.events.emit('capability_guidance:register_static', ...)` form if/when guidance is reintroduced.
- Dead `dynamicCapabilityGuidance` infrastructure was left partially wired with no producers. Either remove it or document that it is reserved for future dynamic capability guidance.

## Full Round 1 Review

# Code Review — AutoTOON extension stack

**Date:** 2026-04-07  
**Reviewer:** Sandpiper agent  
**Scope reviewed:** committed AutoTOON stack from `8c40aab9` (`Merge standup-concurrency-fix to main`) through `42cf9aa5` (`Lean all the way in: just 'autotoon' everywhere 🎤`) in `~/git/sandpiper-ai`  
**Important scope note:** I intentionally ignored the unrelated dirty working-copy state currently sitting on top of the bookmark (`.sandpiper/docs/mutation-testing.md`, deletion of `.sandpiper/docs/toon-extension.md`, `bun.lock`), and reviewed the committed stack only.

## Verdict

**Good implementation momentum, but not review-clean yet.**

The JSON→TOON conversion path itself is small, clear, and well-tested. The problem is that one of the two headline responsibilities from the work plan — **prompt-side TOON/AutoTOON awareness** — is implemented via a cross-extension registry design that directly conflicts with this repo's documented jiti/extension-loading model, and the test suite does not actually verify the real cross-extension load path. On top of that, the documentation layer is not in a final consistent state after the rebrand.

## Quantitative Review

### Commands run

```bash
cd ~/git/sandpiper-ai && bun run check:tsc
cd ~/git/sandpiper-ai && bun run check:biome-check
cd ~/git/sandpiper-ai && bun x vitest run \
  extensions/autotoon/autotoon.test.ts \
  extensions/autotoon/autotoon-integration.test.ts \
  extensions/system/capability-guidance-registry.test.ts \
  extensions/system/startup-hooks.test.ts \
  packages/core/src/system-startup.test.ts
cd ~/git/sandpiper-ai && uvx lizard -l typescript \
  extensions/autotoon/autotoon.ts \
  extensions/system/capability-guidance-registry.ts \
  packages/core/src/system-startup.ts
cd ~/git/sandpiper-ai && scc --format json --by-file \
  extensions/autotoon/autotoon.ts \
  extensions/system/capability-guidance-registry.ts \
  packages/core/src/system-startup.ts
cd ~/git/sandpiper-ai && bunx jscpd extensions/autotoon extensions/system packages/core/src/system-startup.ts \
  --reporters json --output /tmp/autotoon-jscpd
```

### Results

| Gate / metric | Result |
|---|---|
| `bun run check:tsc` | ✅ clean |
| targeted vitest set | ✅ 41/41 |
| `bun run check:biome-check` | ⚠️ **2 warnings** (both `noExplicitAny` in `extensions/autotoon/autotoon-integration.test.ts`) |
| `lizard` max CC | ✅ `buildSandpiperSystemPrompt` at 15, `tryConvertJsonToToon` at 7 |
| `scc` | ✅ small production footprint (`autotoon.ts` 69 code lines; registry 22; system-startup 72) |
| `jscpd` | no concerning production duplication in the reviewed implementation; duplicates reported were in tests, especially existing `startup-hooks.test.ts` scaffolding |

## What looks good

1. **The conversion middleware is pleasantly small and comprehensible.**
   - `extensions/autotoon/autotoon.ts` does one thing: inspect `tool_result` text blocks and replace only the ones that benefit from conversion.
   - The fast-reject / parse / encode / return flow is easy to audit.

2. **The core hook choice is correct.**
   - `tool_result` is a real Pi/Sandpiper interception point. This is not a made-up event name.
   - Using `tool_result` is much less invasive than overriding specific tools or post-processing full provider payloads.

3. **The system-prompt ordering changes are tested and bounded.**
   - `packages/core/src/system-startup.ts` adds explicit `staticCapabilityGuidance` / `dynamicCapabilityGuidance` slots without turning prompt assembly into a mess.
   - The prompt-order tests are good and the metrics stay under control.

4. **The implementation mostly stayed within scope.**
   - No sprawling new dependency graph.
   - No provider-specific hacks.
   - No invasive tool rewrites.

---

## Findings

### Major — The capability-guidance registry relies on cross-extension shared module state, but this repo's extension-loading docs explicitly say that does not work

**Files:**
- `extensions/system/capability-guidance-registry.ts`
- `extensions/autotoon/autotoon.ts`
- `extensions/system/startup-hooks.ts`
- `.sandpiper/docs/extension-loading.md`
- `.sandpiper/docs/pi-api-pitfalls.md`

The design assumes this flow works:

1. `extensions/autotoon/autotoon.ts` imports `registerStaticCapabilityGuidance()` from `../system/capability-guidance-registry.js`
2. AutoTOON calls it at module load time
3. Later, `extensions/system/startup-hooks.ts` calls `assembleStaticCapabilityGuidance()`
4. The same registry array is observed from the system extension's side

That assumption directly conflicts with the repo's own extension-loading guidance:

- `.sandpiper/docs/extension-loading.md:12` — "Each extension gets its own jiti module scope. Do not rely on module-level state being shared across extensions."
- `.sandpiper/docs/extension-loading.md:32` — "Each jiti load creates a separate module scope — module-level state is not shared between extensions. Use `pi.events` for cross-extension communication."
- `.sandpiper/docs/pi-api-pitfalls.md:10` — "Treat module-level state as extension-local. Separate jiti loads do not share module instances."
- `.sandpiper/docs/pi-api-pitfalls.md:50` — "A module-level array in `packages/core` will be a different instance in each extension. Use `pi.events` for cross-extension communication instead."

The current tests do **not** resolve this contradiction, because they never exercise the real cross-extension load path:

- `extensions/system/capability-guidance-registry.test.ts` proves the registry works **inside one module instance**
- `extensions/system/startup-hooks.test.ts` registers guidance and calls `registerStartupPromptHooks()` **inside the same test module**
- nothing verifies that a separately loaded extension package (`extensions/autotoon/`) can register a block that the separately loaded system extension later sees

So the stack currently proves **JSON→TOON conversion**, but it does **not** prove the prompt-injection half of the feature in the real runtime model.

This is the most important review finding because the work plan explicitly gave the extension two responsibilities:
1. tool result conversion
2. system prompt injection

The implementation may only be reliably satisfying (1).

**Concrete fix required (based on established extension-loading constraints):** migrate capability guidance to **system-owned state + `pi.events` registration**.

Proposed implementation contract:

1. In `extensions/system/startup-hooks.ts`, keep registry state local to the system extension (e.g., `Map<string, string>` keyed by capability id).
2. Register system listeners on `pi.events`:
   - `capability_guidance:register_static` → payload `{ id: string, block: string }` (upsert by `id`)
   - `capability_guidance:unregister_static` → payload `{ id: string }` (delete by `id`)
   - (optional for future use) dynamic equivalents with provider ids
3. Build prompt guidance from system-owned state only (do not import mutable registry arrays across extension boundaries).
4. In `extensions/autotoon/autotoon.ts`, emit `capability_guidance:register_static` during extension init with a stable id (e.g., `autotoon`) instead of importing `registerStaticCapabilityGuidance()`.
5. Keep `appendEntry()` out of this path unless you explicitly need durable audit/history semantics; it is not the right default for live cross-extension coordination.

Required tests for this fix:
- registering static guidance from AutoTOON path appears in system prompt assembly
- duplicate register with same `id` does not duplicate output (id-based upsert)
- unregister removes guidance
- no registration yields no capability guidance block

---

### Major — The docs layer is not in a single-source-of-truth state after the rebrand; stale TOON docs and stale test commands remain in the committed stack

**Files:**
- `.sandpiper/docs/autotoon-extension.md`
- committed `.sandpiper/docs/toon-extension.md` at `42cf9aa5`
- `AGENTS.md`

The stack currently leaves two active docs in `.sandpiper/docs/`:
- `.sandpiper/docs/autotoon-extension.md`
- `.sandpiper/docs/toon-extension.md`

The old `toon-extension.md` is not just redundant; it is stale. In the committed branch it still references pre-rebrand paths and commands like:
- `extensions/toon/toon-converter.ts`
- `bun test extensions/toon/toon-converter.test.ts`
- `bun test extensions/toon/toon-converter-extension.test.ts`

Worse, the **new routed doc** (`autotoon-extension.md`) still contains stale test commands in its Testing section:

```bash
bun test extensions/toon/toon-converter.test.ts
bun test extensions/toon/toon-converter-extension.test.ts
```

Those files do not exist in the renamed implementation. The current code lives under:
- `extensions/autotoon/autotoon.ts`
- `extensions/autotoon/autotoon.test.ts`
- `extensions/autotoon/autotoon-integration.test.ts`

This matters because `AGENTS.md` now routes AutoTOON work to `.sandpiper/docs/autotoon-extension.md`. So the official route for future sessions already contains false commands, while a stale duplicate doc remains beside it in the active docs directory.

That violates the repo's own doc guidance:
- active operational docs live in `.sandpiper/docs/`
- update docs as decisions are made
- **deduplicate aggressively**

**Recommendation:**
- delete the stale `toon-extension.md` from the committed branch (the current dirty working copy appears to already be heading this direction)
- update `autotoon-extension.md` so every path/command reflects the final renamed implementation
- do one quick `rg -n 'extensions/toon|toon-converter' .sandpiper/docs AGENTS.md` sweep before claiming the docs done

---

### Minor — The new tests leave biome warnings behind via `as any`, so the branch is not actually zero-warning clean

**File:** `extensions/autotoon/autotoon-integration.test.ts`

`bun run check:biome-check` reports two warnings:
- line 63: `const result = (await handlerResult) as any;`
- line 127: `const result = (await handlerResult) as any;`

The command exits 0, but the repo rule is explicit: **zero warnings, zero errors**.

This is small and easy to fix with a narrow result shape instead of `as any`, for example a local interface or `unknown` plus a runtime shape assertion.

It’s not a substantive design problem, but it does mean the branch is not as self-verified as the report claimed.

---

## Final assessment

### Strengths
- Core conversion middleware is good
- Hook choice is good
- Prompt-ordering changes are thoughtful and metric-clean
- Targeted tests are green

### Guideline-following trend
- **Improved vs earlier rough rounds:** better commit structure, tighter scope, and better targeted tests.
- **Still below project bar:** violated a known extension-loading constraint already documented in repo guidance, left docs partially stale after rebrand, and left lint warnings in new tests.

### What still blocks a clean approval in my view
- The prompt-injection architecture depends on a cross-extension shared-state assumption that the repo docs explicitly say is invalid
- The docs layer is still split/stale after the rebrand
- The lint/check pass still has warnings in new tests

## Suggested next actions

1. **Implement event-driven capability guidance registration (system-owned state)**
   - add the `pi.events` register/unregister contract described above
   - remove cross-extension mutable import dependency on `capability-guidance-registry.ts`
   - update tests to cover register/upsert/unregister semantics explicitly

2. **Complete docs rebrand in one pass**
   - delete `.sandpiper/docs/toon-extension.md`
   - in `.sandpiper/docs/autotoon-extension.md`, replace stale test commands with current paths:
     - `bun x vitest run extensions/autotoon/autotoon.test.ts`
     - `bun x vitest run extensions/autotoon/autotoon-integration.test.ts`
   - run: `rg -n 'extensions/toon|toon-converter' .sandpiper/docs AGENTS.md` and confirm zero matches

3. **Clear remaining lint warnings in tests**
   - replace the two `as any` casts in `autotoon-integration.test.ts` with a typed local helper or guarded `unknown` narrowing
   - re-run `bun run check:biome-check` and ensure warning count is zero

4. **Re-verify before claiming done**
   - `bun run check:tsc`
   - `bun run check:biome-check`
   - `bun x vitest run extensions/autotoon/autotoon.test.ts extensions/autotoon/autotoon-integration.test.ts extensions/system/startup-hooks.test.ts packages/core/src/system-startup.test.ts`

If those items land, this should move from "good-but-not-clean" to a likely approval quickly.


## Full Round 2 Review

# Code Review Round 2 — AutoTOON extension stack

**Date:** 2026-04-07
**Reviewer:** Sandpiper agent
**Scope:** `feat/autotoon` bookmark in `~/git/sandpiper-ai` (rebased on top of updated `main` as of 2026-04-07)
**Current tip:** `cc34b448` (Fix test code type errors — round 1 continued)
**Baseline:** previous round-1 review in `~/.sandpiper/agent/inbox/autotoon-extension-review.md`
**Note:** The stack was rebased after the original review. Commit IDs from the original scope (`8c40aab9..d00ebc74`) are no longer valid. Use `jj log -r 'main..feat/autotoon'` to see the current stack.

## Verdict

**Effectively mergeable. Round-1 blockers are resolved. Only two small docs/cleanup nits remain.**

The implementing agent did a real, substantive pass on every round-1 finding:
- Cross-extension shared state has been **correctly migrated to `pi.events`** with system-owned state.
- Docs rebrand is **mostly finished** (stale files removed, test commands corrected).
- `as any` warnings are **gone**, replaced with typed narrowing via `as { content: ... } | undefined` and optional-chain accessors.

This is the right direction, and it's meaningfully cleaner than the round-1 stack.

## Quantitative Re-Verification

Commands run:
```bash
cd ~/git/sandpiper-ai
bun run check:tsc
bun run check:biome-check
bun x vitest run \
  extensions/autotoon/autotoon.test.ts \
  extensions/autotoon/autotoon-integration.test.ts \
  extensions/system/capability-guidance-registry.test.ts \
  extensions/system/startup-hooks.test.ts \
  packages/core/src/system-startup.test.ts
rg -n 'extensions/toon|toon-converter|registerStaticCapabilityGuidance|registerDynamicCapabilityGuidance' .sandpiper/docs AGENTS.md extensions packages/core/src
rg -n 'as any' extensions/autotoon extensions/system packages/core/src
```

Results:

| Gate | Result |
|---|---|
| `bun run check:tsc` | ✅ clean |
| `bun run check:biome-check` | ✅ clean, **zero warnings** (previous round had 2) |
| targeted vitest set | ✅ **40/40** passing across 5 files |
| `rg` for `as any` in reviewed scope | ✅ only a comment in `test-helpers.ts` mentioning the anti-pattern |
| `rg` for stale rebrand markers | ⚠️ see Minor 1 below |

## Round-1 blocker status

### ✅ Major 1 — Cross-extension shared module state (RESOLVED)

**Before:** extensions synchronously imported `registerStaticCapabilityGuidance()` from a sibling extension's module, which does not work across jiti loads.

**After:** clean event-driven contract:

- `extensions/system/capability-guidance-registry.ts` now exposes `registerCapabilityGuidanceHandlers(pi)` and uses a `Map<string, StaticGuidanceEntry>` as system-owned state.
- System extension registers listeners for:
  - `capability_guidance:register_static` (upsert by `id`)
  - `capability_guidance:unregister_static` (delete by `id`)
- `extensions/autotoon/autotoon.ts` now calls:
  ```ts
  pi.events.emit('capability_guidance:register_static', {
    id: 'autotoon',
    block: AUTOTOON_SYSTEM_GUIDANCE,
  });
  ```
- `extensions/system.ts` calls `registerCapabilityGuidance(pi)` first, before any other extension can emit — correct ordering.
- Id-based upsert prevents `/reload` duplicate accumulation.
- Deterministic ordering via sort-by-id.

This is exactly the contract I recommended and the agent implemented it cleanly. Tests in `capability-guidance-registry.test.ts` cover register/upsert/unregister/ordering/empty-state — **6 tests, all explicit about the event contract**.

**Verdict: fully fixed, no follow-up needed.**

### ✅ Major 2 — Docs rebrand cleanup (MOSTLY RESOLVED)

**Before:** stale `toon-extension.md` coexisted with `autotoon-extension.md`; stale test commands referenced `extensions/toon/toon-converter*.test.ts`.

**After:**
- `.sandpiper/docs/toon-extension.md` has been **deleted** (confirmed via diff).
- All test commands in `autotoon-extension.md` now correctly point at `extensions/autotoon/*` and related test files.
- No references to `extensions/toon/` or `toon-converter` remain in `.sandpiper/docs/` or `AGENTS.md`.

**Verdict: substantially fixed, with two small stale remnants flagged under Minor 1 and Minor 2 below.**

### ✅ Minor — Two `as any` casts in integration tests (RESOLVED)

**Before:** two `as any` casts in `autotoon-integration.test.ts` generating biome warnings.

**After:** the casts are replaced with narrow typed casts (`as { content: Array<{ text: string; type?: string }> } | undefined`) plus optional-chain accessors and explicit `at(...)` reads. Biome check is now fully clean.

**Verdict: fixed.**

---

## Remaining findings (both minor, non-blocking)

### Minor 1 — `.sandpiper/docs/autotoon-extension.md` still shows the old registration API

**File:** `.sandpiper/docs/autotoon-extension.md`

The **Extension Loading** section still has this stale code snippet:

```typescript
import { registerStaticCapabilityGuidance } from '../system/capability-guidance-registry.js';

registerStaticCapabilityGuidance(AUTOTOON_SYSTEM_GUIDANCE);
```

That function **no longer exists**. The real API is:

```typescript
pi.events.emit('capability_guidance:register_static', {
  id: 'autotoon',
  block: AUTOTOON_SYSTEM_GUIDANCE,
});
```

`rg` confirms this is the only place in the repo still showing the old import. This is the single remaining stale-rebrand artifact.

**Recommendation:** replace that code block with the `pi.events.emit` form and add a one-line pointer that this pattern is the cross-extension-safe one per `.sandpiper/docs/extension-loading.md` / `pi-api-pitfalls.md`.

### Minor 2 — Dead `dynamicCapabilityGuidance` infrastructure is partially wired up with no producers

**Files:**
- `packages/core/src/system-startup.ts` (lines 9, 77)
- `packages/core/src/system-startup.test.ts` (lines 86, 99)
- `.sandpiper/docs/autotoon-extension.md` (prompt-order diagram mentions `[dynamicCapabilityGuidance]`)

The registry was simplified to static-only (correct call for the current feature), but the consuming system-prompt assembly still has:

```ts
readonly dynamicCapabilityGuidance?: string;
// ...
options.dynamicCapabilityGuidance ?? '',
```

Nothing ever populates this field. `startup-hooks.ts` no longer passes it. The only references are the field declaration, its default, and one test that explicitly sets it to verify prompt ordering.

This is **dead infrastructure for a feature that was intentionally descoped**. Two acceptable directions:

1. **Remove it** — if dynamic guidance is not part of the current plan, drop the option field, drop its use in `buildSandpiperSystemPrompt`, drop the `dynamic` system-startup test, and remove the `[dynamicCapabilityGuidance]` line from the prompt-order diagram in `autotoon-extension.md`. This is the cleaner option.
2. **Keep it deliberately** — if dynamic is planned next, add a `// reserved for dynamic capability guidance (not yet wired)` comment on the field, otherwise the next reader will wonder if it's a bug.

Either choice is fine; not leaving it in limbo is what matters.

**Recommendation:** pick one and record the intent.

---

## Process / guideline adherence — round-over-round trend

**Improved this round:**
- Commit structure is more honest: round-1 fixes landed as two follow-up commits (`48ed85b8`, `d00ebc74`) rather than being squashed into a single "we fixed everything" blob.
- Real event-contract tests, not just same-module-instance tests.
- `bun run check:biome-check` is clean this time — **zero warnings**.
- Docs work was done at the same time as code work (no more "code done, docs stale" gap).
- Stale files were actually removed, not just shadowed.

**Still mildly adrift:**
- The stale code snippet in `autotoon-extension.md` would have been caught by the exact "rg for stale patterns" step in the universal "Done means verified" rule. This is small, but it's the same failure mode — thin self-verification on docs.
- Dead `dynamicCapabilityGuidance` infrastructure shipped without an explicit "reserved/planned" note.

Net: **meaningfully better execution discipline this round**, and the remaining issues are minor enough that I would approve this stack for merge as soon as Minor 1 is fixed (5-minute edit) and Minor 2 is decided (remove or annotate).

## Suggested next actions

1. Replace the stale code snippet in `.sandpiper/docs/autotoon-extension.md` with the `pi.events.emit(...)` form, and delete the `[dynamicCapabilityGuidance]` line from the prompt-order diagram if you're removing it.
2. Pick a direction on `dynamicCapabilityGuidance`:
   - remove the field + its prompt-assembly usage + its single dedicated test, **or**
   - add a `// reserved — not currently produced by any extension` comment to the field.
3. Re-run: `bun run check:tsc && bun run check:biome-check && bun x vitest run extensions/autotoon/*.test.ts extensions/system/capability-guidance-registry.test.ts extensions/system/startup-hooks.test.ts packages/core/src/system-startup.test.ts` and cite the green output.
4. Run one more sweep: `rg -n 'extensions/toon|toon-converter|registerStaticCapabilityGuidance' .sandpiper/docs AGENTS.md` — expected: zero matches.

After those, this is done.

---

# Activity Log

## 2026-04-21T03:48:21.705Z

- **description**: added (15 lines)

## 2026-04-28T18:33:16.354Z

- **description**: 15 lines → updated (442 lines)

## 2026-06-03T04:43:52.491Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → Huginn

## 2026-06-03T04:44:12.691Z

- **status**: IN PROGRESS → NOT STARTED
- **assignee**: Huginn → UNASSIGNED
