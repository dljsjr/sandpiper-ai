---
title: "Chorus room widget starves the transcript in fullscreen TUI mode"
status: COMPLETE
resolution: DONE
kind: BUG
priority: HIGH
assignee: "sandpiper-0.84-dev"
reporter: USER
created_at: 2026-08-07T19:28:18.767Z
updated_at: 2026-08-07T19:50:41.649Z
---

# Chorus room widget starves the transcript in fullscreen TUI mode

In fullscreen TUI mode the chorus room widget can grow until it squeezes the host session's transcript off screen, and fullscreen's scrolling applies only to the transcript region - so the agent's own chat becomes unreachable. Found by Doug in fullscreen dogfood, 2026-08-07.

Mechanism: extensions/chorus/chorus-ui.ts bounded the widget by ENTRY COUNT, not by viewport share - CHORUS_TRANSCRIPT_ENTRY_LIMIT (12) entries, each up to CHORUS_TRANSCRIPT_ENTRY_LINE_LIMIT = 4 lines, so the aboveEditor widget could render roughly 1 + 12*4 = 49 lines. Traced further via pi-tui's fullscreen layout allocator (interactive-mode.js / components/stack.js): the dock (widget+editor+footer+status) is a flex sibling of the scrollable transcript with grow:0, so it never yields space back; the transcript's basis:0 disqualifies it from the shrink pass once its size hits minSize(1), so the entire deficit lands on the dock until terminalRows-1 is crossed, at which point the transcript snaps to exactly 1 row in a single step (not graceful shrinking). Confirmed via source reading that regular (non-fullscreen) TUI mode is unconditionally exempt: TuiMainScreen.doRender() never clips render output to terminal height and unconditionally writes every line, relying entirely on the real terminal's native scrollback - there is no viewport/flex-layout concept in that code path at all.

DESIGN ITERATION (2026-08-07): an initial mitigation (drop CHORUS_TRANSCRIPT_ENTRY_LIMIT from 12 to 4, entry-count based) was implemented, tested, and submitted for review, then withdrawn and superseded before review completed. Doug, live in the fullscreen dogfood room, pointed out entry-count clamping is the wrong unit: it makes the widget's height jitter on every arrival (short messages waste slots, long messages still blow the height budget), and a 15-row terminal isn't worth designing for while a 24-row terminal is a real, common case. Settled on clamping by RENDERED LINE COUNT instead.

SHIPPED: extensions/chorus/chorus-ui.ts + chorus-ui.test.ts.
- computeChorusTranscriptLineBudget(rows) = min(30, rows - 12): flat 30-line cap on terminals >=42 rows, scaling down on shorter terminals (reserving ~12 rows for editor/footer/status overhead) so a 24-row terminal still keeps the transcript alive, floored at 1.
- selectTranscriptLinesWithinBudget: drops OLDEST entries first once the running line total would exceed budget; always renders at least the most recent entry even if it alone exceeds budget (no narrower fallback than "show the latest message"); no truncation indicator (not requested - the line budget alone already fixes starvation and jitter).
- tui.terminal.rows is read fresh inside render() every call, not captured at construction - confirmed necessary because 0.84.0 made fullscreen runtime-toggleable via /settings and the terminal can resize between frames.
- Applied in BOTH TUI modes, not just fullscreen: harmless in regular mode (native scrollback already absorbs unbounded content, confirmed via source) and it also removes the jitter there.
- CHORUS_TRANSCRIPT_ENTRY_LIMIT (12) is kept as a separate, unchanged DATA RETENTION bound; the line budget is an independent RENDER bound layered on top - named as such in comments so the two concerns don't get re-merged later.
- 8 new tests: budget arithmetic (flat cap, scaling, floor-of-1), keep-all-when-within-budget, drop-oldest-first, guaranteed-minimum-entry floor case, short-vs-long-message tradeoff, small-terminal budget never exceeded.
- Verified: `bun run test:vitest -- extensions/chorus` -> 37/37 pass (29 pre-existing unchanged + 8 new). `bun check` clean (syncpack, tsc, biome). jj change mtxsxksqoynmntqwnkpwwnuzlxznqtky / commit 02bc25bc1977b711b4f3112907f5756c0dc36125.

NOT ADDRESSED, DELIBERATELY OUT OF SCOPE (per Doug's explicit low-investment directive for Chorus, which is slated for a rewrite under TAT-70, currently on hold):
- The class-of-bug: ANY aboveEditor/belowEditor widget whose combined dock height crosses terminalRows-1 collapses the transcript the same way - this fix bounds Chorus's own contribution, it doesn't change the underlying pi-tui allocator behavior.
- A truncation indicator ("+N earlier") - considered and designed in an earlier iteration, dropped because Doug didn't ask for one once the budget shape changed to line-based.
- Sub-13-row terminals can still see a single long (4-line) entry slightly overshoot a budget of 1-2 lines - accepted as out of scope per "15-row terminals aren't worth designing for."

UPSTREAM-ADJACENT, NOT OURS, NOT FILED (Doug's call if ever): give the transcript's scroll view a minSize above 1, and/or clamp widget containers to a viewport share, in pi-tui itself - independent of how well-behaved any single widget is.

---

# Activity Log

## 2026-08-07T19:33:40.187Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-08-07T19:35:06.313Z

- **description**: 9 lines → updated (21 lines)

## 2026-08-07T19:35:14.554Z

- **description**: 21 lines → updated (33 lines)

## 2026-08-07T19:40:20.103Z

- **description**: 33 lines → updated (17 lines)

## 2026-08-07T19:40:23.429Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-08-07T19:40:27.986Z

- **assignee**: AGENT → sandpiper-0.84-dev

## 2026-08-07T19:46:16.757Z

- **status**: NEEDS REVIEW → IN PROGRESS
- **description**: 17 lines → updated (21 lines)

## 2026-08-07T19:46:16.815Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-08-07T19:50:41.650Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
