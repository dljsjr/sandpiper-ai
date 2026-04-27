# Session Stand-Up

## Session update — 2026-04-27

### Accomplished
- Created standalone reinforced-guidance repository at `/Users/doug.stephen/git/reinforced-guidance` and committed initial migration:
  - `f33a2b72 RG-1: extract reinforced-guidance standalone workbench`
- Migrated RG TypeScript prototype, prompts/evals, dashboard, curated data, experiment reports/artifacts, docs, task metadata, and project-local dashboard skill into the standalone repo.
- Finished Sandpiper cut-over by abandoning the mutable `qxpptpxm::xlwnnkxv` RG/aux-guidance stack and deleting bookmark `feat/reinforced-guidance`.
- Confirmed `extensions/system/reinforced-guidance`, `.sandpiper/test/wrapper-lab`, and aux-guidance files are absent from current Sandpiper history/tree.
- Removed now-unused root `node-llama-cpp` dependency/catalog entry from Sandpiper after dropping RG/wrapper/aux work.
- Updated `.sandpiper/docs/specs/agent-guidance-evolution.md` to point Axis 3 to standalone `~/git/reinforced-guidance`.
- Marked `AGENT-81` as `NEEDS REVIEW`.

### Verification
- In `/Users/doug.stephen/git/reinforced-guidance`:
  - `bun install`
  - `bun run check`
  - `python3 -m py_compile dashboard/*.py dashboard/pages/*.py`
  - DuckDB sanity check: `matrix_runs=164`, `prompt_retrievals=6316`, `rule_grades=30`, and no old `sandpiper-ai` / `rg-matrix` path references in key DB tables.
  - Dashboard smoke: `PORT=8788 bash dashboard/start_dashboard.sh`, `curl -fsS http://127.0.0.1:8788/`, then stopped the 8788 test process.
- In `/Users/doug.stephen/git/sandpiper-ai` after abandoning the RG stack:
  - `bun install`
  - pending final verification after the small docs/dependency cleanup commit.

### In Progress
- Old rg-matrix dashboard process `rg-dashboard` remains running at `http://127.0.0.1:8787` for the user’s current browser workflow.
- Standalone dashboard can be started with `bun run dashboard`; use `PORT=8788 bun run dashboard` if 8787 is occupied.

### Next Session
- Review standalone repo commit and Sandpiper cleanup commit.
- Decide whether to delete/archive old provenance workspaces `/Users/doug.stephen/git/rg-matrix` and `/Users/doug.stephen/git/rg-experiments` after confirming the standalone repo has everything needed.
- Continue/finish visual browser review of the Rule Grading page as needed.

### Notes
- Pre-existing unrelated package/CLI edits were preserved separately in `/tmp/sandpiper-package-version-edits-after-abandon.patch` before final Sandpiper cleanup. Reapply/review them separately if desired.
- Old RG/aux material remains recoverable through `jj op log` if needed.
