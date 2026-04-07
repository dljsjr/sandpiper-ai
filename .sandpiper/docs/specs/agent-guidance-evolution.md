# Agent Guidance Evolution

**Status**: Axis 1 complete; Axis 2 planned; Axis 3 in progress
**Related tasks**: AGENT-34 (✅ complete), AGENT-35 (📋 planned), AGENT-64 (🔄 in progress)
**Last updated**: 2026-04-16
**Pi version**: 0.67.4 verified

## Three-Axis Model

This work has **three distinct axes**:

1. **Axis 1 — Static Progressive Disclosure** (✅ COMPLETE)
   - What guidance lives in root `AGENTS.md` vs focused docs vs module-local docs
   - Prompt assembly order for prefix caching
   - Cold-start detection and continuity aids
   - **Deliverable**: Pi Developer Documentation Suite + prompt architecture

2. **Axis 2 — Deterministic Enforcement** (📋 PLANNED)
   - Hard blocking of incorrect tool use via `tool_call` hook
   - Redirect with targeted feedback
   - Workflow invariants (jj, tasks, dist/)
   - **Status**: Deferred until Axis 1 proves out

3. **Axis 3 — Dynamic Progressive Disclosure** (🔄 IN PROGRESS)
   - Rule extraction + retrieval for context-aware guidance injection
   - Soft enforcement via salience boosting
   - Local Llama inference for rule selection
   - **Deliverable**: Reinforced Guidance system (AGENT-64)

## Purpose

Capture the current direction for the next revision of repository guidance.
This work has two related but distinct axes:

1. **Prompt architecture / progressive disclosure** — what guidance lives in root `AGENTS.md` versus focused docs versus module-local docs, and how to keep the always-loaded prompt small and high-signal.
2. **Deterministic harness behavior** — future extension-hook work that can block or redirect incorrect tool use and provide targeted feedback.

The current decision is to **prioritize the prompt architecture first** and defer the hook design to a later phase. This document records both the near-term plan and the findings that should be preserved for that later design pass.

Sandpiper now also injects a compact startup context that can include:
- active task summary
- meaningful dirty-working-copy summary
- cold-start-specific guidance when the session appears to begin without restored conversation history

## Decisions Already Made

- There are **three axes** to the problem: static disclosure (Axis 1), deterministic enforcement (Axis 2), and dynamic disclosure (Axis 3).
- The repository pursued **Axis 1 first** (✅ complete), then **Axis 3** (🔄 in progress), with **Axis 2 deferred** (📋 planned).
- Root `AGENTS.md` should be **small, routing-oriented, and invariant-focused**, but not aggressively minimized at the expense of clarity.
- The optimization target is **clear routing + tiny high-signal leaf docs + minimal duplication**, not an arbitrary token ceiling.
- Startup continuity should include **compact live context**, not just narrative context: active tasks and meaningful dirty-working-copy state are worth surfacing.
- Inactive / archived projects should be filtered from startup project-routing injection to keep the prompt denser and more relevant.
- Deterministic enforcement (Axis 2) is promising, but the repo should **not** jump straight into hook implementation before the prompt-side taxonomy is crisp.
- **Dynamic disclosure (Axis 3) is the natural evolution of Axis 1** — moving from static prompt assembly to context-aware rule injection.

---

## Axis 1 — Prompt-Side Progressive Disclosure Plan

### Goal

Make guidance easier to follow in cold-start sessions by tightening the role of each instruction layer and reducing duplication between them.

### Target Guidance Layers

| Layer | Role | Should Contain | Should Avoid |
| --- | --- | --- | --- |
| Root `AGENTS.md` | Global hot memory | Non-negotiable repo invariants, short workflow rules, routing table, brief enforcement summary | Deep domain detail, long explanations, repeated local architecture |
| `.sandpiper/docs/*.md` | Topic-specific leaf docs | Compact high-signal rules, pitfalls, canonical example paths, longer reference below | Repeating global invariants or module-local ownership info |
| Subdirectory `AGENTS.md` / `README.md` | Local architecture and module conventions | Current source-of-truth docs, architecture notes, local testing/building guidance | Repo-wide rules already covered by root `AGENTS.md` |
| Tasks / standup | Work continuity | Decision history, next steps, blockers, work-specific context | Standing architectural guidance |
| Skills | Cross-project procedural expertise | How to use task system, jj, standup process, etc. | Repo-specific architecture detail |

### Root `AGENTS.md` Revision Goal

The next revision of root `AGENTS.md` should bias even more toward:

1. **Invariants**
   - use `jj`, not `git`
   - use the tasks CLI, not direct task file edits
   - edit source, not generated/dist artifacts
   - build/test/lint expectations
2. **Routing**
   - when touching build/distribution paths, read the build/extension-loading docs
   - when touching env/config migration paths, read env-var guidance
   - when touching CLI code, read CLI guidance
   - when touching Pi integration/system extension code, read Pi API pitfalls
3. **Escalation / source-of-truth cues**
   - current docs beat historical docs
   - active docs live in `.sandpiper/docs/`
   - historical material lives in `.sandpiper/archive/`

### Leaf Doc Shape

The next revision should standardize focused docs around a compact, injectable top section plus deeper reference material below.

A suggested pattern:

```md
# Topic Name

Read when: <specific triggers / paths / kinds of change>
Last verified: YYYY-MM-DD

## Key Rules
- 3-8 compact, high-signal bullets
- Prefer positive phrasing where possible
- Include only details that are easy to forget or hard to infer

## Canonical Examples
- `path/to/file.ts`
- `path/to/other-file.ts`

## Reference
Longer explanation, rationale, caveats, and examples.
```

The exact heading names do not matter as much as the shape:
- short top section
- explicit trigger for when to read it
- canonical example paths
- full detail below

### Best Candidates for This Pass

These docs are the strongest candidates for a tighter leaf-doc pass because they map directly to recent confusion or frequent repo-specific mistakes:

1. `.sandpiper/docs/build-system.md`
2. `.sandpiper/docs/extension-loading.md`
3. `.sandpiper/docs/pi-api-pitfalls.md`
4. `.sandpiper/docs/env-vars.md`
5. `.sandpiper/docs/cli-development.md`

Suggested emphasis for each:

- **build-system.md**
  - extensions load from source via jiti
  - `dist/package.json` is not a dependency manager
  - when to run `devtools/postinstall.sh`
  - when package builds are required
- **extension-loading.md**
  - source-loaded extension model
  - jiti expectations and limitations
  - what `/reload` does and does not refresh
- **pi-api-pitfalls.md**
  - extension event semantics
  - lifecycle gotchas
  - cases where implementation behavior should be verified against source/examples
- **env-vars.md**
  - PI_/SANDPIPER_ mirroring
  - `resolveEnvVar()` conventions
  - avoid inventing ad hoc path knobs
- **cli-development.md**
  - Commander patterns
  - Bun-first commands
  - packaging/build expectations for binaries

### Module-Local Doc Cleanup Goal

Module-local `AGENTS.md` and `README.md` files should also be normalized so they:

- clearly identify the **current source of truth**
- state when they should be read
- avoid restating repo-wide rules
- focus on local architecture, not history

### Lightweight Execution Plan

1. **Audit root `AGENTS.md`**
   - classify each section as keep / move / shorten / delete
2. **Refactor the five highest-value focused docs**
   - add consistent trigger + compact top section + canonical examples
3. **Sweep local docs in the most active modules**
   - especially `extensions/system.ts`-related guidance and `extensions/shell-relay/`
4. **Align prompt templates with the layered guidance model**
   - especially templates that steer implementation, refactoring, status review, and self-reflection
5. **Do a duplication pass**
   - remove repeated explanations that now have a single source of truth
6. **Cold-start evaluation pass**
   - test whether a fresh agent can route itself correctly for known tricky scenarios

### Suggested Cold-Start Scenarios

Use these as reality checks for the prompt-only revision before building hooks:

1. **Build/dist/source-loading confusion**
   - Can a cold-start agent correctly reason about extension source loading, postinstall, and when builds are required?
2. **Shell-relay architecture routing**
   - Can it identify the correct current docs and avoid historical artifacts?
3. **Env/config migration work**
   - Can it route itself to env-var guidance instead of inventing new path knobs?
4. **CLI/package changes**
   - Can it determine when package build steps are required versus when postinstall alone is enough?
5. **General source-of-truth questions**
   - Can it find the active doc instead of reading archived/historical material?

### ✅ Implemented Prompt-Side Additions (Phase 1 Complete)

The prompt-side revision now includes several low-cost continuity aids:

- active / archived project filtering for `<available_projects>` injection
- compact active-task context injection
- compact dirty-working-copy context injection (with noisy task-history churn filtered out)
- a `/cold-start-check` prompt template for manual re-orientation
- cold-start guidance appended on the first agent turn when the session appears to start without restored conversation history
- startup prompt assembly ordered for prefix caching: static sections first, then dynamic sections by volatility, with one-shot cold-start guidance last to maximize shared prefix between resumed and cold-start first turns

**Major deliverables**:
1. **Pi Developer Documentation Suite** (`.sandpiper/docs/pi-dev-suite/`) — 14 comprehensive docs covering all aspects of Pi extension development, with Sandpiper-specific patterns in `PI-DEV-SANDPIPER-PATTERNS.md`
2. **Reinforced Guidance System** (`extensions/system/reinforced-guidance/`) — Rule extraction + retrieval pipeline for dynamic rule injection (AGENT-64)
   - `rule-extractor.ts` — Extracts operational rules from AGENTS.md into structured TOON format
   - `rule-retriever.ts` — Retrieves applicable rules for a given prompt with cross-domain calibration
   - Local Llama 3-4B-Instruct inference on Apple Silicon
   - **Current status**: Stage 1 (extractor scope eval) running, fixing TOON quoting reliability issues
   - **Architecture**: 9-stage plan in `STAGE4-DESIGN.md` and `STAGE5-OVERVIEW.md`
   - **Quality**: Retriever 93% accuracy (63/68) on synthetic evals; extractor TOON output ~3-14% corruption rate (active fix target)

### Success Criteria

The prompt-side revision is successful if, in cold-start situations:

- the agent more reliably reads the right focused docs without being reminded
- repo-specific mistakes become less common even without harness enforcement
- root `AGENTS.md` is easier to scan and less repetitive
- focused docs become more obviously actionable
- prompt templates reinforce the routing/source-of-truth model instead of bypassing it
- historical/reference material is easier to distinguish from active guidance

### Non-Goals for This Pass

- No deterministic tool blocking yet
- No large new framework extension for tool interception yet
- No regex-heavy convention police system yet
- No attempt to minimize root `AGENTS.md` to an arbitrary token budget at the expense of useful invariants

---

## Axis 1 — Static Progressive Disclosure (✅ COMPLETE)

### Goal

Make guidance easier to follow in cold-start sessions by tightening the role of each instruction layer and reducing duplication between them.

### Target Guidance Layers

| Layer | Role | Should Contain | Should Avoid |
| --- | --- | --- | --- |
| Root `AGENTS.md` | Global hot memory | Non-negotiable repo invariants, short workflow rules, routing table, brief enforcement summary | Deep domain detail, long explanations, repeated local architecture |
| `.sandpiper/docs/*.md` | Topic-specific leaf docs | Compact high-signal rules, pitfalls, canonical example paths, longer reference below | Repeating global invariants or module-local ownership info |
| Subdirectory `AGENTS.md` / `README.md` | Local architecture and module conventions | Current source-of-truth docs, architecture notes, local testing/building guidance | Repo-wide rules already covered by root `AGENTS.md` |
| Tasks / standup | Work continuity | Decision history, next steps, blockers, work-specific context | Standing architectural guidance |
| Skills | Cross-project procedural expertise | How to use task system, jj, standup process, etc. | Repo-specific architecture detail |

### ✅ Deliverables

1. **Pi Developer Documentation Suite** (`.sandpiper/docs/pi-dev-suite/`) — 14 comprehensive docs
2. **Prompt assembly order** for prefix caching (static → dynamic → cold-start)
3. **Cold-start detection** via `session_start` reason field + session content inspection
4. **Continuity aids**: active tasks, working copy, standup injection

---

## Axis 2 — Deterministic Enforcement (📋 PLANNED)

**Status**: Deferred until Axis 1 proves out

### Goal

Block incorrect tool use deterministically and redirect with targeted feedback.

### Approach

1. Detect incorrect or risky tool use via `tool_call` hook
2. Block / redirect deterministically
3. Inject targeted guidance on the **next** model turn via `context`
4. Let the agent retry with better locality

### Likely First Enforcement Candidates

1. **Block `git` usage and redirect to `jj`**
2. **Block direct edits to `.sandpiper/tasks/**`** → redirect to `sandpiper-tasks`
3. **Block edits to `dist/**`** → redirect to source files
4. **Block edits to `.sandpiper/archive/**`** by default
5. **Block obvious bash-as-file-reader misuse** → redirect to `read`
6. **Block writing agent-operational docs into `docs/`** → redirect to `.sandpiper/docs/`

### Key Pi APIs

- `tool_call` hook — can block tool calls before execution
- `tool_result` hook — can modify results or mark errors post-execution
- `context` injection — can queue targeted guidance for next model turn
- Tool overrides — can replace built-in tools with wrapped versions

**Full details**: See "Axis 2 — Deferred Deterministic Guidance / Enforcement Memo" section below.

---

## Axis 3 — Dynamic Progressive Disclosure (🔄 IN PROGRESS)

**Task**: AGENT-64  
**Status**: Stage 1 (extractor scope eval) running; TOON quoting reliability being fixed

### Goal

Evolve Axis 1's static disclosure into **context-aware dynamic disclosure** — inject only the rules that apply to the current prompt, boosting salience without overwhelming the context window.

### Architecture

```
AGENTS.md content
      ↓
[Rule Extractor] → TOON rules (id, rule, applies_to, scope)
      ↓
[Rule Retriever] → Applicable rules for current prompt
      ↓
[before_agent_start] → Inject as high-salience prompt section
```

### Components

**Rule Extractor** (`rule-extractor.ts`):
- Extracts operational rules from AGENTS.md-style documents
- Outputs structured TOON format: `{ id, rule, applies_to, scope }`
- Local Llama 3-4B-Instruct via `node-llama-cpp` on Apple Silicon
- **Performance**: ~24.5s cold, ~19s warm (model sharing saves 2.9GB)
- **Quality**: TOON output ~3-14% corruption rate (active fix target)

**Rule Retriver** (`rule-retriever.ts`):
- Retrieves applicable rules for a given user prompt
- Cross-domain calibration examples (cooking, medical, legal) prevent ID hallucination
- **Quality**: 93% accuracy (63/68 synthetic evals)
- Remaining failures: over-retrieval when no matching rule exists

**Injection** (`before_agent_start` hook):
- Injects retrieved rules as high-salience prompt section
- Participates in prefix caching when rules are stable
- Dynamic per-turn based on prompt context

### Relationship to Other Axes

| Aspect | Axis 1 (Static) | Axis 3 (Dynamic) | Axis 2 (Enforcement) |
|--------|-----------------|------------------|---------------------|
| **Mechanism** | Fixed prompt sections | Retrieved rules per-turn | Hard blocking |
| **Timing** | Session start | Per-turn (before_agent_start) | Per-tool-call |
| **Enforcement** | None (always visible) | Soft (salience boost) | Hard (preflight block) |
| **Scope** | All guidance always | Context-applicable rules | Workflow invariants |
| **Model role** | Reads all, follows some | Reads subset, follows more | Forced to follow |

**Strategic insight**: Axis 3 tests whether **dynamic salience** improves compliance without hard blocking. Success may reduce Axis 2 scope.

### Current Status

**Stage 1** (Extractor scope eval):
- ✅ Extractor + Retriever implemented
- ✅ Synthetic evals passing (93% accuracy)
- 🐛 TOON quoting reliability being fixed (~3-14% corruption)
- 📋 Scope classification evals pending

**Remaining stages** (2-9):
- Stage 2: Real-source scope smoke test
- Stage 3: Scope-sensitivity probe
- Stage 4: Universal injection mechanism
- Stage 5: Retriever architecture change
- Stage 6: Bootstrap rules for cold start
- Stage 7: MVP experiment
- Stage 8: Production logging
- Stage 9: Continuous improvement

**Documentation**: `STAGE4-DESIGN.md`, `STAGE5-OVERVIEW.md`, `HANDOFF.md`

### Success Criteria

- Statistically significant reduction in rule violations vs. static baseline
- TOON corruption rate < 1%
- Retrieval latency < 5s (currently ~24s extraction + ~2s retrieval)
- No increase in false positives (over-retrieval)

---

## Axis Interactions

**Axis 1 → Axis 3**: Static disclosure provides the baseline ruleset that Axis 3 dynamically subsets.

**Axis 3 → Axis 2**: If Axis 3 succeeds (soft enforcement via salience), Axis 2 scope may be narrower (only hard violations). If Axis 3 fails, Axis 2 becomes more urgent.

**Axis 1 + Axis 3 + Axis 2**: Full system would be:
- Axis 1: Core invariants always visible (jj, tasks, source-of-truth)
- Axis 3: Context-appropriate operational rules injected per-turn
- Axis 2: Hard blocks for workflow invariants that remain violated

### High-Level Conclusion

The article's overall strategy is compelling, but Sandpiper/Pi does **not** appear to expose the exact same hook model as Claude Code's "PreToolUse inject additionalContext before the tool runs" flow.

The likely Sandpiper-native shape is:

1. detect incorrect or risky tool use
2. block / redirect / annotate deterministically
3. inject targeted guidance on the **next** model turn
4. let the agent retry with better locality

---

## Summary

| Axis | Status | Task | Deliverable |
|------|--------|------|-------------|
| **Axis 1** — Static Disclosure | ✅ Complete | AGENT-34 | Pi Dev Suite + prompt architecture |
| **Axis 2** — Deterministic Enforcement | 📋 Planned | AGENT-35 | Hard blocking via `tool_call` hook |
| **Axis 3** — Dynamic Disclosure | 🔄 In Progress | AGENT-64 | Reinforced Guidance (rule extraction + retrieval) |

**Next steps**:
1. Complete Axis 3 Stage 1 (fix TOON quoting, finish scope evals)
2. Run Axis 3 MVP experiment (Stages 4-7)
3. Evaluate Axis 3 results → determine Axis 2 scope
4. Begin Axis 2 design if soft enforcement insufficient


---

## Phase 1 Completion Notes (2026-04-16)

### Leaf-Doc Pass Status

The "5 highest-value focused docs" identified for tighter leaf-doc pass have been addressed:

| Original Doc | Status | Notes |
|--------------|--------|-------|
| `build-system.md` | ✅ Kept in `.sandpiper/docs/` | Agent-operational, appropriate where it is |
| `extension-loading.md` | ✅ Kept in `.sandpiper/docs/` | Agent-operational, appropriate where it is |
| `pi-api-pitfalls.md` | 📦 Archived | Content consolidated into Pi Dev Suite |
| `env-vars.md` | ✅ Kept in `.sandpiper/docs/` | Agent-operational, appropriate where it is |
| `cli-development.md` | 📦 Moved to `docs/dev/` | Contributor-facing, not agent-operational |

### Documentation Reorganization

Completed documentation reorganization by audience:

- **`.sandpiper/`** → Agent-facing (operational docs, config, tasks)
- **`docs/`** → Human-facing (features, guides, contributor docs)
  - `docs/features/` → User-facing feature docs
  - `docs/dev/` → Contributor/developer docs
  - `docs/architecture/` → Architecture decisions

### Deliverables

1. ✅ **Pi Developer Documentation Suite** (15 docs) — Now in `docs/dev/pi-dev-suite/`
2. ✅ **Documentation routing** — README.md (users), CONTRIBUTING.md (contributors), AGENTS.md (agent)
3. ✅ **Task storage docs** — Reorganized to `docs/features/tasks/`
4. ✅ **Feature docs** — AutoTOON in `docs/features/autotoon.md`

### Success Criteria Met

- ✅ Agent more reliably reads the right focused docs (`.sandpiper/docs/` is curated)
- ✅ Root `AGENTS.md` is routing-oriented with clear escalation paths
- ✅ Focused docs are actionable and audience-appropriate
- ✅ Historical/reference material distinguished from active guidance (`.sandpiper/archive/`)
- ✅ Documentation organized by audience, not by historical accident

