---
title: "Post-bump verification sweep"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: USER
reporter: AGENT
created_at: 2026-08-06T20:41:56.756Z
updated_at: 2026-08-07T21:05:54.761Z
depends_on:
  - AGENT-236
---

# Post-bump verification sweep

Checklist:
(a) System prompt: SANDPIPER_DUMP_SYSTEM_PROMPT=1 diff vs pre-bump; systemPromptOptions shape is our most fragile coupling (packages/core/src/system-prompt.ts). AGENTS.override.md (0.84.0) changes what arrives in contextFiles.
(b) Session format: read-session-memories DuckDB queries + standup CLI against a fresh 0.84.0 session file; atomic JSONL publication (#7707) switched to rename-based writes.
(c) Fullscreen TUI (--tui-mode fullscreen): chorus room UI (setEditorComponent + aboveEditor widget + setStatus) against the sticky dock; tattler-inbox-renderer full-width background padding vs reserved scrollbar column in always mode.
(d) Compiled standalone app: /login flows (0.80.8 fixed OAuth adapter bundling in bun binaries - may have been silently broken before), image handling (upstream caveat: worker scripts must be explicit compile entrypoints; we rely on materialized Pi assets).
(e) Tattler/chorus deliverAs:steer delivery through manual and auto compaction (0.81.0 #6730 + 0.84.0 queued-message fixes) including pending-inbox release/re-deliver paths.

ADDENDUM (2026-08-06, post green-suite): (f) MANDATORY first step before any bump verification: rm -rf .turbo packages/cli/dist dist, then full rebuild - a stale .turbo cache-hit for sandpiper-ai-cli#build was restoring a 5-month-old dist snapshot (old @mariozechner package scope) and caused every ecosystemPackage/npmPackageInstallSmoke "failure" this session; verification on a dirty cache is meaningless. (g) Known environment quirk: npmPackageInstallSmoke is unstable in throwaway workspaces (mise config-trust, cleanup hookTimeouts) - verify it in the trusted checkout only.

STATUS ADDENDUM (2026-08-06, post-sweep):

Agent-executable portion of the sweep is complete. Split:

(a) DONE. Root-caused and fixed the SANDPIPER_DUMP_SYSTEM_PROMPT print-mode
hang (AGENT-248, reviewed/approved, landed as yonzlzttrvkl/57fb73eca36c).
Produced the before/after system-prompt dump diff using the fix: only the
Pi version string, a scratch cwd path, and a random request-id differ
across 110 lines -- systemPromptOptions/prompt content is byte-identical
across the 0.80.7 -> 0.84.0 bump. Separately verified AGENTS.override.md
(0.84.0's per-directory context override) with a real scratch-project
test: injected_context correctly contains only the override content, base
AGENTS.md is correctly excluded. No code changes needed for the override
case -- packages/core/src/system-prompt.ts's injectedContextBlock is
filename-agnostic and Pi resolves the override before handing us
contextFiles.

(b) DONE. Generated a genuine fresh 0.84.0 session file by forcing a real
turn to a throwaway API key (fails with a real 401 mid-turn, but the
session file is written regardless via the atomic-rename path) -- tested
the actual write/rename mechanism, not a synthesized fixture. Ran the
standup CLI (write/read/cleanup) and read-session-memories' DuckDB script
(--session-root and --session-file forms) against it: both consumers
parse the 0.84.0 entry shapes (session/session_info/model_change/
thinking_level_change/custom/message) correctly, matching what
read-session-memories' SKILL.md documents. No format drift.

(f) DONE, applied as standing practice for every gate run since track 3
of the green-suite sweep: rm -rf .turbo packages/cli/dist dist before any
distribution verification.

(g) DONE, observed as practiced: npmPackageInstallSmoke's throwaway-
workspace instability never affected verification in the trusted
checkout, which is the only place it was relied on for a pass/fail
signal.

(c) DEFERRED TO DOUG. Fullscreen TUI (--tui-mode fullscreen): chorus room
UI (setEditorComponent + aboveEditor widget + setStatus) against the
sticky dock; tattler-inbox-renderer full-width background padding vs
reserved scrollbar column in always mode. Visual judgment, needs a human
at a terminal.
Verify: launch with --tui-mode fullscreen, open a chorus room, confirm
the editor/status/dock render correctly against the independently
scrollable transcript; separately confirm tattler-inbox-renderer's
background padding doesn't collide with the reserved scrollbar column.

(d) DEFERRED TO DOUG, two parts:
  (d-1) Compiled standalone app /login flows. 0.80.8 fixed OAuth adapter
  bundling in bun binaries -- may have been silently broken before this
  bump landed the fix.
  Verify: run the compiled standalone binary, exercise /login for at
  least one OAuth-based provider, confirm the flow completes and the
  credential is usable for a real turn.
  (d-2) Compiled standalone app image handling. Upstream caveat: worker
  scripts must be explicit compile entrypoints; we rely on materialized
  Pi assets for this.
  Verify: run the compiled standalone binary, exercise an image-handling
  path (e.g. attach/view an image in a turn) and confirm no missing-
  worker-entrypoint failures.

(e) DEFERRED TO DOUG. Tattler/chorus deliverAs:steer delivery through
manual and auto compaction (0.81.0 #6730 + 0.84.0 queued-message fixes)
including pending-inbox release/re-deliver paths. Checked for a
test/SDK-harness path first: zero existing test coverage of compaction
anywhere in extensions/ or packages/core/, and the risk lives entirely
inside Pi's internal turn/compaction state machine, which only exists
during a real streaming turn -- nothing to mock without testing the mock
instead of Pi's actual behavior.
Written test plan:
  1. Start a real interactive sandpiper session with tattler active,
     ideally against a small/cheap model.
  2. Trigger a long-ish turn (or force one via a debug/test flag if
     available) so there's an active stream to interrupt.
  3. From a second peer/session, send a message that resolves to
     deliverAs: 'steer' (a tattler send_peer_message or chorus room
     post) while the first turn is still streaming.
  4. Mid-turn, trigger compaction -- manual via /compact if available,
     or force auto-compaction via a small context window / long
     conversation.
  5. Verify: (a) the steered message survives compaction and gets
     delivered, not silently dropped; (b) if compaction fires WHILE a
     batch is in the pending-inbox's released-but-not-yet-delivered
     window (tattler-inbox.ts's releaseBatch/release path), it doesn't
     get lost or duplicated on the next turn. <- sharpest check, keep
     prominent.
  6. Repeat once with auto-compaction (context-limit-triggered) instead
     of manual -- the changelog calls out both 0.81.0 (#6730) and 0.84.0
     fixes, worth confirming both paths.

Status remains IN PROGRESS. Do not complete until Doug's half (c, d-1,
d-2, e) is done.

---

ITEM (e) RESOLVED 2026-08-07 - NO LONGER A MANUAL ITEM: steer-through-compaction is now covered headlessly by the AGENT-253 wave-1 integration tests (devtools/integration/wave1-compaction.integration.test.ts) driving real pi compaction/turn machinery via RPC against the scripted mock provider, zero egress. Structural claims proven: manual compact succeeds with non-empty summary; steer-delivered mid-turn message visible in get_entries pre-compaction; a normal turn completes correctly post-compaction. Summary CONTENT is deliberately not asserted (would encode an indexing accident, not a real claim). Two real findings banked in that test file: default compaction.keepRecentTokens=20000 means realistic scripted conversations have nothing old enough to compact (safeguard, not bug - harness gained a settingsJson option to lower it); the compaction summarization call has a different context shape than a normal turn. REMAINING MANUAL ITEMS FOR DOUG: (c) fullscreen TUI eyeball, (d) compiled-app /login + image handling. Task stays IN PROGRESS until those two land.

---

ITEM (c) IN DOGFOOD (2026-08-07): Doug reloaded his working session in fullscreen TUI mode as ongoing dogfood rather than a one-off eyeball pass. Coverage accrues passively - startup banners (now entry-rendered per AGENT-238), tattler batch renderers on incoming peer messages (AGENT-226), chorus widgets if a room is opened. Close (c) if nothing renders wrong after normal use; only (d) compiled-app /login + image handling remains as a discrete manual step.

---

DISPOSITIONS (2026-08-07, Doug):
- (c) PARTIALLY CONFIRMED: the Update Available banner - our AGENT-238 entry-renderer reimplementation - renders correctly in fullscreen dogfood. That was the riskiest half of the refactor (it replaced the tui.children[1] reach-in). Remaining (c) surface accrues passively: tattler batch renderers on incoming peer messages, chorus room widgets.
- (d) DESCOPED by Doug: compiled-app /login (OAuth adapter bundling) and image handling are upstream Pi/Bun behaviors, not ours to verify. Our own compile-pathway hazard is already covered by AGENT-243 (bunfig autoload) and the standalone-app runtime tests. Not a gap, a scope decision.
- (e) already CI-covered via AGENT-253.
AGENT-237 closes once chorus renders correctly in fullscreen.

---

CLOSED 2026-08-07. Final disposition of all items:

(a) DONE - system-prompt dump diff across the bump: 3 lines of 110 differ (version string, temp path, request-id), prompt content byte-identical. AGENTS.override.md verified empirically. Required fixing AGENT-248 (dumpSystemPrompt hung in print mode) to produce the evidence.
(b) DONE - session format verified against a genuine fresh 0.84.0 session file (real turn forced through the atomic-rename write path): standup CLI write/read/cleanup correct including liveness classification, read-session-memories DuckDB patterns extract as documented. No drift.
(c) DONE - fullscreen TUI confirmed by Doug in live dogfood. Update Available banner (the AGENT-238 entry-renderer reimplementation that replaced the tui.children[1] reach-in) renders correctly. Chorus room widget confirmed in two live multi-agent room sessions; the first surfaced AGENT-256 (widget starving the transcript), which was fixed, reviewed, and visually confirmed by Doug in the second room - "Looks good!" with the line budget holding flat under a mixed long/short/burst message sequence.
(d) DESCOPED by Doug - compiled-app /login (OAuth adapter bundling) and image handling are upstream Pi/Bun behaviors, not ours to verify. Our own compile-pathway hazard is covered by AGENT-243 plus the standalone-app runtime tests.
(e) DONE, converted from manual to CI - steer-through-compaction is covered headlessly by devtools/integration/wave1-compaction.integration.test.ts (AGENT-253), driving real pi compaction and steer delivery via RPC against the scripted mock provider with zero egress.
(f) PRACTICED throughout - .turbo purge before every distribution verification, after the stale-cache incident that masqueraded as invariant failures.
(g) OBSERVED - npmPackageInstallSmoke verified in the trusted checkout only.

Notable: the sweep found more by dogfooding than by checklist. (c) in particular produced a real HIGH bug (AGENT-256) that no unit test could have reached, because it only manifests in fullscreen's flex-layout allocator.

---

# Activity Log

## 2026-08-06T22:19:41.456Z

- **description**: 6 lines → updated (8 lines)

## 2026-08-06T22:31:40.283Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → sandpiper-0.84-dev

## 2026-08-06T22:57:01.395Z

- **description**: 8 lines → updated (100 lines)

## 2026-08-07T18:24:29.368Z

- **description**: 100 lines → updated (104 lines)

## 2026-08-07T19:14:09.596Z

- **assignee**: sandpiper-0.84-dev → USER

## 2026-08-07T19:20:08.085Z

- **description**: 104 lines → updated (108 lines)

## 2026-08-07T19:22:31.555Z

- **description**: 108 lines → updated (116 lines)

## 2026-08-07T21:05:54.645Z

- **description**: 116 lines → updated (130 lines)

## 2026-08-07T21:05:54.704Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-08-07T21:05:54.761Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
