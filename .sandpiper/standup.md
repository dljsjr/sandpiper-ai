# Session Stand-Up

## 019f1f3f-a3b7-78da-acae-8e5208ae7e9b (Updated: 2026-07-01T21:42:23.521Z)

Session file: /Users/doug.stephen/.sandpiper/agent/identities/Roux/sessions/2026-07-01T19-54-52-215Z_019f1f3f-a3b7-78da-acae-8e5208ae7e9b.jsonl

### Accomplished
- **Trail bug fixed & committed** (jj change `wqomzvnw`/`32422bf8`, "fix(trail): include task description body in `task show` output"): `formatTaskDetail()` in `packages/trail/src/core/format.ts` never rendered the description body — bug since Trail's original implementation, NOT a TCL-138 regression (confirmed via git history: TCL-138 commits only did mechanical renames, never touched description logic). Fix reads description from disk on demand via `extractDescription()` in `task-show.ts` (mirrors existing `--format raw` path), applied whenever `!opts.metadataOnly`, attached to primary task only (not subtasks) in json/toon output. 2 new regression tests. 397 tests pass, tsc clean, biome clean. Manually verified end-to-end via built binary.
- **Tattler `/reload`/`/new` bug fixed & committed** (jj change `vosuowwk`/`2f543dc7`, "fix(tattler): survive /reload and /new without EEXIST/stale-socket failures"): `session_shutdown` never cleaned up the identity tmpfile or the UDS socket file. Two failure modes: (1) `tmp.fileSync` uses `O_CREAT|O_EXCL`, so recreating the identity tmpfile at the same sanitized path (which `/reload` reuses via the persisted session UUID, and `/new` reuses when `--tattler-id` is a fixed override) threw uncaught EEXIST and crashed `session_start`; (2) `server.close()` doesn't unlink the UDS file and doesn't settle synchronously, so the next `session_start`'s `isSocketAlive` probe could race it. Fix: `session_start` now unlinks a pre-existing identity file before recreating it; `session_shutdown` now awaits the socket close and unlinks the socket path. New `extensions/tattler/index.test.ts` (3 tests) covers `/reload`, `/new` with a fixed `--tattler-id`, and identity-file cleanup — all pass. tsc clean, biome clean (only pre-existing turbo.json env-var warnings, unrelated).
- jj graph now: `rlkzxzss` (prior head, "chore: skill and doc cleanup") → `wqomzvnw` (Trail fix) → `vosuowwk` (Tattler fix) → `@` (working copy, unrelated pre-existing churn: `bun.lock` + several `package.json` files, left uncommitted per Doug's explicit instruction — not touched, not investigated this session).

### In Progress
- Nothing in flight. Both bugs are closed out: root-caused, fixed, tested, typechecked, linted, committed as separate jj changes.

### Next Session
- Doug is starting a fresh session specifically to resume **RG-230** (reinforced-guidance project): daemon startup doesn't rehydrate persisted observed sources into `sourceManifest.sources` at init, so the stat-based drift probe (RG-234) never covers observed sources (`obs-*`) until after they're re-added mid-session — meaning drift on those sources doesn't self-heal until a later retrieval after they're already stale. This was surfaced as a live-validation finding while shipping RG-234 (YAAMS fact 392) and is the natural next pickup. RG-233 (drift-triggered async reindex) and RG-226 (daemon eviction primitive) also shipped this cycle and are at NEEDS REVIEW in Trail — worth checking review status too.
- Neither Trail nor Tattler fix has been pushed/PR'd — still local jj commits on top of `main`. Doug hasn't indicated push intent; surface that decision if relevant.

### Blockers
- None.

### Context
- Repo: `/Users/doug.stephen/git/sandpiper-ai` (jj colocated with git).
- Trail source of truth: `packages/trail/src/`; do not edit `dist/` or the bundled `packages/resources/skills/sandpiper/tasks/scripts/trail` directly.
- Tattler extension: `extensions/tattler/index.ts` (main), `extensions/tattler/tattler-ipc.ts`, `extensions/tattler/tattler-identity.ts`, `extensions/tattler/tattler-protocol.ts`, `extensions/tattler/tattler-runtime-dir.ts`.
- Both fixes originated as a detour from planned RG-230 work — Doug asked to root-cause and fix these two bugs first before returning to reinforced-guidance.

## claude-code (Updated: 2026-07-02T05:54:40.873Z)

Session file: 

### Accomplished
- Audited and rewrote `tasks` SKILL.md (packages/resources/skills/sandpiper/tasks/SKILL.md) to model `trail`'s full CLI surface: query filters (-a/-k/--parent/--subtasks-only), full-text search modes (BM25 relevance default, --regex, --ripgrep), --sort/--limit, bulk operations (--filter-status/-q/--bulk pattern on update/pickup/complete), --dir/--format interleaving, and the subtask-breakdown planning heuristic. Verified every documented flag against live `--help` output at every command level (root/group/leaf), not just source reading — caught and fixed a real gap (global -d/-f flags don't show in subcommand --help, Commander quirk). All examples smoke-tested against real repo task data.
- Fixed a real bug in `start_background_process`: `ProcessManager.spawn()` (packages/core/src/process-manager.ts) checked `.has(id)` instead of `.running`, so a process ID never freed up after exit (including external SIGKILL) — respawning under the same id always failed. Fixed to check `.running`; confirmed load-bearing by reverting and observing 4 tests go red, then green. Completion-notification wiring (sendSystemNotification on exit) was already built from a prior session — verified, not rebuilt. Strengthened tool description/promptGuidelines/result-payload text (extensions/system/background-process-tools.ts) to actually reference the auto-notification so agents stop polling.
- Redesigned `standup` CLI + skill (packages/sandpiper-standup-cli, packages/resources/skills/sandpiper/standup/SKILL.md) after tracing the destructive-read bug to its root: liveness (is the writer's process alive) was being used as a proxy for "has this been consumed," which breaks under multi-agent concurrency AND rules out any dormant-thread continuity (user's ADHD-driven long gaps between picking threads back up). `read`/`write` no longer delete anything — only explicit `cleanup` prunes, with concrete guidance in the skill on when to actually call it. Added portable `--pid <n>` on `write` so non-sandpiper harnesses (Claude Code, etc.) can get accurate Active/Inactive liveness display without touching sandpiper's own pidfile registry; `--file` is now optional. Renamed `--uuid`/`-u` to `--id`/`-i` throughout (CLI flag, StandupSection field, help text) since there was never an actual UUID-format constraint — this also formalizes persistent-agent-identity (e.g. "Piper") as a first-class use case: same id across sessions upserts the same section instead of siloing. Header format dropped the literal "Session " prefix (`## Piper (Updated: ...)` not `## Session Piper (...)`), parser stays backward-compatible with old on-disk format.
- All work followed red→green→refactor TDD per explicit user correction mid-session; full standup-cli suite at 49/49 passing, tasks-skill and background-process changes each independently smoke-tested against real data/binaries. `bun run prepare:distribution` run after every change to keep `~/.claude/skills/*` in sync with source.

### In Progress
- Nothing left mid-flight — all three threads (tasks skill audit, background-process fix, standup redesign) reached a clean, tested, distributed stopping point this session.

### Next Session
- The `standup` skill's "Working from a non-sandpiper harness" section is net-new and unvalidated by real external-harness usage yet beyond this session's own smoke tests and this very note (written as Claude Code via --id claude-code) — worth confirming it keeps reading naturally as more of this happens.
- `jj` skill's high bypass rate remains open but explicitly out of scope (ceiling note: wording fixes already tried and failed; mechanical tool-call interception is the real fix, not requested this session).
- Same CLI-capability-audit treatment (recurse --help per level, verify docs against real flags) hasn't been run yet on the on-demand skills `age`, `ast-grep`, or `toon` — flagged as candidates but not started.

### Blockers
- None.

### Context
- Global-guidance jj repo (~/.sandpiper/agent/) still has uncommitted edits to `playbooks/workflow/orienting.md` and `playbooks/skills/loading.md` from earlier in this session (skill-loading rationale fixes) — auto-revertible per Doug's own note, not blocking anything.
- Key design memory for future standup work: liveness and time-since-write are BOTH ruled out as auto-GC signals — the former breaks under concurrency, the latter breaks under legitimate long-gap continuity. Only explicit `cleanup` should ever delete. Don't re-litigate this without revisiting that constraint.

## 019fd8a0-3964-7fc8-84f3-1656595afa4d (Updated: 2026-08-07T18:33:48.515Z)

Session file: /Users/dstephen/.sandpiper/agent/sessions/--Users-dstephen-git-sandpiper-ai--/2026-08-06T19-50-06-948Z_019fd8a0-3964-7fc8-84f3-1656595afa4d.jsonl

### Accomplished
- **INTEGRATION LANE COMPLETE (AGENT-249 tree closed): 250 design / 251 harness / 252 mock+teardown / 253 wave-1 coverage, all APPROVE.** Chain: 23 changes, every one independently reproduced by the reviewer. Head qoxwsurzrxly/1b758d34cd9b.
- **AGENT-237 item (e) CONVERTED FROM MANUAL TO CI**: wave1-compaction.integration.test.ts drives real pi compaction + steer delivery via RPC against the mock, zero egress; structural claims asserted (compact succeeds w/ non-empty summary, steer visible in get_entries pre-compaction, normal turn completes post-compaction), summary content deliberately NOT asserted (would encode an indexing accident). Doug's manual checklist is now TWO EYEBALL ITEMS ONLY: (c) fullscreen TUI, (d) compiled-app /login + image handling.
- Wave-1 coverage: skill + autotoon isolated, autotoon+probe combinatoric (real cross-extension tool_result seam), MIN_JSON_BYTES=256 threshold verified, rpc-driver line-buffering extracted to a pure function w/ deterministic unit tests incl. the U+2028/U+2029 case pi's own docs warn about. Compiled-binary smoke evaluated and DEFERRED as named wave-2 scope (not silent debt, recorded on AGENT-249).
- Guard build-then-teardown closed honestly: root cause was our own branding trap in ad hoc commands (never the harness); Doug's question - what makes a PINNED invocation not use the mock? nothing, it hard-errors - dissolved the whole edifice. Guard/log/4 transport patches/drills/fake-AWS all deleted; --offline replaces them; postmortem in the design doc.
- New standing rule proven out: serialized full-suite runs (machine load hit 26 from our own concurrency). Dev's caveated-not-claimed citation vindicated by reviewer's clean serialized run.

### In Progress
- NOTHING. Both agents STOOD DOWN. Dev is writing a short end-of-package summary FOR DOUG (what the lane gives him, what it deliberately doesn't cover, one-paragraph guard postmortem in their own words), then holds.

### Next Session
- Drain Tattler (dev's summary will be there). ALL remaining work is Doug-gated: AGENT-255 (strict re-adoption - UNBLOCKED now that the mock provider exists; give it a scriptable OpenAI-strict validator), TCL-144 (Trail VCS test rewrite, his direction), AGENT-237's two eyeball items, three upstream-asks (AGENT-245 env prefix / EntryRenderOptions outputPad / strict-prefer gating), parked build decisions (turbo clean-at-start, root vitest workspace config, bun check warning enforcement), constraint lifts (zero-TouchID, tripwires on agent shell usage, VCS network ops), push/PR strategy on 23 commits, claude-cli-provider wedge follow-through, NAV-85 + incubating-repo follow-ons.

### Blockers
- None mechanical. Everything above is a Doug decision.

### Context
- Tripwire/op-shim rules still govern AGENT SHELL USAGE (separate from the deleted harness guard). Zero-TouchID unlifted. Serialization rule in force. Task storage separate-branch; working copy clean but for this note.
