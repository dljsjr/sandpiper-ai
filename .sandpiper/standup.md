# Session Stand-Up

## Session 019d9978-4f6c-75ef-9fa0-25818888a447 (Updated: 2026-04-20T22:19:01.447Z)

Session file: /Users/doug.stephen/.pi/agent/sessions/--Users-doug.stephen-git-sandpiper-ai--/2026-04-17T03-24-51-948Z_019d9978-4f6c-75ef-9fa0-25818888a447.jsonl

### Accomplished
- **Test fixes for upstream Pi API changes** (`systemPromptOptions` on `BeforeAgentStartEvent`):
  - Rewrote `packages/core/src/system-prompt.test.ts` for new API: `PiSystemPromptOptions` instead of `ExtensionAPI` stubs, `toolGuidanceBlock` instead of `fallbackToolGuidanceBlock`, `buildSandpiperSystemPrompt` instead of `buildSystemPrompt`
  - Fixed `extensions/system/startup-hooks.test.ts`: updated mock name, event stubs include `systemPromptOptions`
  - All passing: 108/108 core + 65/65 extensions, lint clean
- **AGENTS.md cleanup pass on both files**:
  - **Homedir** (`~/.pi/agent/AGENTS.md`): ~80 lines → 52 lines. Removed preamble fat, `projects.toon` line, inbox format spec, documentation rule duplicate. Tightened version control, verification, parse-don't-validate, task management. Kept skill editing ownership with project-local line removed.
  - **Project** (`AGENTS.md`): ~130 lines → ~95 lines. Condensed header, merged three repo structure tables into one, fixed stale `extensions/system.ts` → `extensions/system/`, absorbed skill ownership into table rows, flattened Core Repo Invariants, merged TypeScript+Architecture, compressed Testing/Linting/Verification, dropped stale feature list from user-facing docs.
  - **Stale refs pass**: all 9 routing table doc paths were stale. Merged extension-loading + pi-api-pitfalls + tui into single pi-dev-suite row. Updated all paths.
- **Prompt dump files removed from history**: `BASE_PROMPT_DUMP.md`, `FULL_PROMPT_DUMP.md`, `REWRITE_DUMP.md` untracked from their respective commits
- **jj skill updated**: Added two FAQ entries — `jj squash` editor hang (always use `-m`), and working copy fragility across graph restructuring
- **Pi PR #3473** open upstream with `systemPromptOptions` changes

### In Progress
- System prompt override detection + gate (planning complete, implementation pending)
- Dynamic sections reintegration (standup, tasks, working-copy, cold-start)

### Next Session
- Implement user override detection + gate (now simplified by `event.systemPromptOptions.customPrompt`)
- Tool guidance A/B test (variant A: full prompt, variant B: no tool info block)
- Reintegrate dynamic sections

### Blockers
- None

### Context
- `main` is now at `feat/system-prompt-slimdown` tip, `feat/reinforced-guidance` stacked on top
- AGENTS.md edits and jj skill edit are in working copy, need to be committed
- `feat/system-prompt-slimdown` bookmark may be redundant now that `main` points to same commit
- Key files: `packages/core/src/system-prompt.ts`, `extensions/system/startup-hooks.ts`, `packages/cli/pi_wrapper.ts`
- **Reinforced guidance session context** (preserved from previous session):
  - Experiment workspace: `~/git/rg-matrix/`
  - DuckDB: `~/git/rg-matrix/results_agents_v2/smoke_history.duckdb`
  - Live retriever prompt: `extensions/system/reinforced-guidance/prompts/RETRIEVER_PROMPT-wip.md` (recovery-v2)
  - Key design docs: `STAGE4-DESIGN.md`, `STAGE5-OVERVIEW.md`, `HANDOFF.md`, `RESEARCH-BRIEF-ID-HALLUCINATION.md` in reinforced-guidance dir
  - Eval assets: `evals/retriever-synthetic-v1.json`, `evals/extractor-scope-eval-v1.json`, `evals/SCOPE-RETRIEVER-AUDIT-2026-04-15.md`
  - Remaining misses: a/p10 (near-miss, 4/5 rules), e/e09 (hosted-review over-retrieval), f-series ceiling cases
