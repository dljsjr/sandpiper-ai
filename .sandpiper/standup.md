# Session Stand-Up

## Session 019eafa2-c0ab-7cc8-8408-e1480955346e (Updated: 2026-06-10T05:20:40.940Z)

Session file: /Users/doug.stephen/.sandpiper/agent/identities/Piper/sessions/2026-06-10T03-45-39-499Z_019eafa2-c0ab-7cc8-8408-e1480955346e.jsonl

### Accomplished
- AGENT-213 family closed DONE after Doug ratified waiting on upstream pi#5581: AGENT-213, AGENT-214, AGENT-215, AGENT-216 all COMPLETE.
- Global guidance Scope 1 committed in Piper global-guidance as `zprqsplq` / `5644eee0`: `orienting.md` maintenance + ceiling notes; `version_control.md` persistent-agent cwd disambiguation.
- AGENT-35 picked up by Piper.
- Created AGENT-35 trifecta in canonical internal docs location and indexed them:
  - `.sandpiper/docs/specs/agent-35-deterministic-tool-use-enforcement-prd.md`
  - `.sandpiper/docs/specs/agent-35-deterministic-tool-use-enforcement-spec.md`
  - `.sandpiper/docs/specs/agent-35-deterministic-tool-use-enforcement-work-plan.md`
  - `.sandpiper/docs/README.md` updated
- Loaded librarian/documentation guidance: docs-diataxis, authoring, project-documentation, doc-standards, writing-for-agents.
- Incorporated Muninn/Huginn must-fix review seams across PRD/spec/work plan:
  - task-store MVP now includes high-confidence simple bash inspection (`cat`, `ls`, `rg`, `grep`, `sed`) of literal inline `.sandpiper/tasks/**`, not only structured `read`/`edit`/`write` tools.
  - MVP loaded state is explicitly successful Sandpiper `skill` tool load only; `/skill:name` expansion is out of scope unless explicitly wired.
  - `ToolPolicyContext` no longer contains generic `cwd`; avoids persistent-agent process-cwd trap.
  - exact read/write/edit path arg names must be verified during Phase 0.
  - `appendEntry()` persistence is phrased as needing wiring, not already available in current skill-loading glue.
- Prettier rerun on the three AGENT-35 docs and `.sandpiper/docs/README.md` after review edits.
- Sent revised docs back to Chorus for review.

### In Progress
- AGENT-35 docs are draft and under review. Awaiting Roux/Huginn/Muninn/Doug feedback on the revised version.
- No docs have been committed yet.

### Next Session
- Resume in `/Users/doug.stephen/git/sandpiper-ai`.
- Load tasks + jj + docs/librarian guidance before editing.
- Check pending Chorus review first.
- If review is clean:
  - update AGENT-35 task body to link the three docs.
  - inspect `jj diff` and ensure only intended files are included.
  - commit docs/index/task changes.
- If review has notes: patch docs, rerun Prettier, resend for review.

### Blockers
- Context reached >80%; this standup is the handoff before compaction.
- Waiting on review. No design blocker.

### Context
- AGENT-35 design settled as catalog-skill precondition enforcement, not RG/Waymark/guidance retrieval.
- MVP: Pi `tool_call` in-process hook, loaded-skill registry at the Sandpiper `skill` tool successful-load choke point, high-confidence rejection only.
- MVP policies: direct `jj` through standard `bash` requires `jj`; inline task-store access requires `tasks` across structured file tools plus high-confidence simple bash inspection.
- `shell_relay` is explicitly out of MVP per Doug: “Yeet shell relay from the MVP. That thing needs a lot of work.”
- PATH shim/wrapper is post-MVP/layer 2 for subprocess-by-name coverage, not MVP.
- Inline `.sandpiper/tasks/**` detector is MVP coverage only, not the full Trail storage model.
- Unrelated working-copy changes were present during verification: `docs/dev/prompt-contributions.md` and standup content. Do not sweep them into an AGENT-35 commit without checking ownership.

## Session 019eafa2-9b01-7427-897e-bfacf6538c3c (Updated: 2026-06-10T14:19:29.659Z)

Session file: /Users/doug.stephen/.sandpiper/agent/identities/Huginn/sessions/2026-06-10T03-45-29-857Z_019eafa2-9b01-7427-897e-bfacf6538c3c.jsonl

### Accomplished
- Closed AGENT-213/214/215/216 as COMPLETE; Sandpiper-side prompt contribution work is done, waiting on upstream pi#5581 for the programmatic-turn/before_agent_start bypass.
- Designed AGENT-35 deterministic tool-use enforcement trifecta and got Doug ratification.
- Piper committed AGENT-35 docs as `xnzqquqt` / `4beac522` — `docs: design deterministic tool-use enforcement`.
- AGENT-35 task body was updated via Trail to point at the PRD/spec/work plan and Phase 0 spike. Task storage is on separate branch/state, not included in the main docs commit.
- Scope-1 playbook improvements were committed earlier by Piper in global guidance: orienting/version_control docs now carry the skill-loading ceiling diagnosis and persistent-agent cwd disambiguation.

### In Progress
- AGENT-35 is ready for Phase 0 spike, but no spike has started.
- Main `sandpiper-ai` working copy still has unrelated/pre-existing dirty files: `.sandpiper/standup.md` and `docs/dev/prompt-contributions.md`. Do not sweep these into unrelated commits.

### Next Session
- If continuing AGENT-35: start Phase 0 spike from `.sandpiper/docs/specs/agent-35-deterministic-tool-use-enforcement-work-plan.md`.
- First spike goal: prove Pi/Sandpiper `tool_call` fires and blocks before standard `bash`; verify read/write/edit argument names; confirm `user_bash` is distinct; keep `shell_relay` out of MVP.
- Preserve AGENT-35 invariants: skill-precondition enforcement only, no RG/Waymark clone, no Shell Relay, no PATH shim in MVP, no DSL, only high-confidence rejects.

### Blockers
- Pi-side pi#5581 remains upstream wait for live prompt-contribution/programmatic-turn correctness.
- AGENT-35 has no implementation blocker yet; Phase 0 spike is the gate before implementation.

### Context
- AGENT-35 docs:
  - `.sandpiper/docs/specs/agent-35-deterministic-tool-use-enforcement-prd.md`
  - `.sandpiper/docs/specs/agent-35-deterministic-tool-use-enforcement-spec.md`
  - `.sandpiper/docs/specs/agent-35-deterministic-tool-use-enforcement-work-plan.md`
- Huginn filed YAAMS facts 130/131/132 and updated `identities/Huginn/CHECKPOINT.md` region `agent35-tool-enforcement`.
- RG injection was observed working at least once during the session as a `reinforced-guidance` system notification.
