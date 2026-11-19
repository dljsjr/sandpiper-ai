# Chorus/Tattler Forceful-Interruption — Research Note

> Archived 2026-11-19 as an unfinished record: restored from change `xqlzzyls` (commit `c8638029`), abandoned on 2026-09-08. Collection stopped in May 2026 before synthesis, and no task tracks the problem.

**Date:** 2026-05-27
**Owner:** Piper (Librarian) — research funnel (Doug: "funnel through Piper")
**Status:** Independent-collection phase. Piper's findings + current-state audit down. Huginn collecting; Muninn resuming fresh (hit context wall). **Synthesis pending all lists.**

**Problem (Doug):** Incoming Chorus/Tattler messages cannot *forcefully* interrupt an agent mid-turn. An agent — especially on a weaker model — locks into an implementation, the room says "stop," and it blows past the signal. Need stronger purchase for urgent messages *without* degrading the normal agent-loop UX.

---

## Current-state audit — what's wired today (and why it fails)

Grounded in the extension source (`extensions/chorus.ts`, `extensions/tattler/*`, `extensions/system/turn-control-tool.ts`).

**Implemented:**
- **All delivery is `deliverAs:'steer'`** (tattler-ipc, chorus, pending-cue). In pi-agent-core, `steer()` injects *after the current assistant turn finishes* — even `triggerTurn:true` waits for the turn boundary; it never preempts a streaming turn or tool-call spree.
- **Busy-path buffers, doesn't deliver:** when `isIdle()===false`, the real payload is held in the pending inbox; only a passive cue (`triggerTurn:false`) goes out. Heads-down agent gets an ignorable nudge; the message waits.
- **Every interrupt path is cooperative + model-initiated:** `tattler_receive` and `done` work by the model choosing to return `{terminate:true}`; the drain re-injects via `steer` on the next idle turn.

**Why it doesn't work (one sentence):** the system is **cooperative-only by construction** — nothing involuntary exists, so stopping requires the agent to *want* to stop. Built for politeness, not urgency.

**Used vs untapped surface:**
- *Used:* `deliverAs:'steer'`, `triggerTurn`, `terminate:true` (tool results), `isIdle()`, `before_agent_start` drain, `agent_end` scheduling, pending inbox.
- *Untapped (where the force lives):* `agent.abort()`, `agent.signal`, `beforeToolCall {block}`, `afterToolCall {content,terminate}`, `getSteeringMessages` (mid-run inject), `prepareNextTurn` (model/thinking swap), `transformContext`, `subscribe` watchdog, `steeringMode:'all'`.

---

## Pi interruption surface (verified — `@earendil-works/pi-agent-core` `Agent` + agent-loop hooks)

- `agent.abort()` — hard-abort current run → stopReason "aborted". Blunt.
- `agent.signal` — active run AbortSignal.
- `steer(msg)` / `followUp(msg)` — post-turn / after-stop injection; `steeringMode: "all" | "one-at-a-time"`.
- `beforeToolCall(ctx) => {block?, reason?}` — **block a tool call before it runs**; loop emits an error tool result with `reason`.
- `afterToolCall(ctx) => {content?, details?, isError?, terminate?}` — **replace the tool result the model reads next** and/or set `terminate` (stop after batch; needs all results in batch to set it).
- `getSteeringMessages() => AgentMessage[]` — **inject messages mid-run** (after a turn's tool calls, before next LLM call). Purpose-built "steer while working."
- `shouldStopAfterTurn(ctx) => boolean` — graceful stop after current turn.
- `prepareNextTurn(ctx) => {context?, model?, thinkingLevel?}` — **swap context, MODEL, or thinking level** before the next turn.
- `transformContext(messages)` — rewrite/inject context before each provider request.
- `subscribe((event, signal) => …)` — lifecycle events (agent_start/turn_start/turn_end/agent_end/tool events) + the abort signal.
- Extension events (`pi.on`): before_agent_start, turn_start, turn_end, tool_call (`ToolCallEventResult`), before_provider_request (`BeforeProviderRequestEventResult`), context, session_*.
- **Open precision Q:** which levers are pure-extension (`pi.on`/event results) vs need harness-level `Agent` wiring. Verify during synthesis.

---

## Piper's solution collection (8)

1. **Hard abort + re-prompt** — `agent.abort()` + re-prompt. Guaranteed stop; loses in-flight work. Emergency tier.
2. **`beforeToolCall` block** — `{block:true, reason:"🛑 URGENT…"}`; next tool call doesn't execute, model gets it as an error result. Stops a spree without killing the turn. **Best fit for the failure mode.**
3. **`afterToolCall` result-hijack** — replace result `content` with the urgent msg + `terminate:true`. Rides in on the next thing the model reads.
4. **`getSteeringMessages` mid-run inject** — loop-polled mid-run steering; more reliable than the post-turn steer queue.
5. **`prepareNextTurn` model-escalation** — on an unheeded stop, swap to a stronger model (+raise thinking) so it can register the signal. Targets "weak model locks in" directly.
6. **Salience ladder (chained)** — normal→steer; elevated→`beforeToolCall` block on *mutating* tools only (reads still flow); critical→abort. Preserves loop UX for normal traffic.
7. **`transformContext` persistent banner** — prepend "⛔ UNADDRESSED URGENT" on *every* provider request until acknowledged; defeats one-shot-ignore.
8. **`subscribe` watchdog** — "urgent unacked after N tool-calls/S seconds" auto-escalates block→abort. Autonomous, not model-goodwill-dependent.

**Piper's seed picks:** #2 + #6 (teeth + UX-preservation), with #5 as the slept-on lever.

---

## Design constraint (Doug, 2026-05-27) — transcript integrity / no cache-busting

Solutions must route through the **session transcript**, not raw provider-payload manipulation. The `'context'` hook and `before_provider_request` payload rewrites are **cache-busters** (bypass the transcript, break prefix caching) → **last resort only.** This demotes Piper #7 (`transformContext` banner) and rules out Muninn #2 (`context` inject) / #3 (`before_provider_request` rewrite) as primary levers. Prefer transcript-routed force: `agent.abort()`, `beforeToolCall {block}`, `afterToolCall`, steer/followUp, and `before_agent_start` system-prompt injection (transcript-safe).

## Muninn's solution collection (8) — ledgered

Same root cause, code-grounded (`chorus.ts:365` `deliverAs:'steer'`; stop unseen until all N tool calls finish; no `abort()` wired; one delivery path regardless of urgency).

1. **`after_provider_response` + abort** — pre-stream kill, before tokens processed. Earliest abort point.
2. `context` per-call inject — *ruled out (cache-buster)*.
3. `before_provider_request` payload rewrite — *ruled out (cache-buster)*.
4. **`message_update` streaming monitor + mid-stream abort** — watch emerging tokens, abort before tool calls are planned. Most proactive; needs pattern defn.
5. **steer + concurrent `abort()`** — abort ends current turn now, steer lands at next turn start. Easiest upgrade; one LLM call sooner than tool-boundary mechanisms.
6. **`tool_call` graduated blocking (mutating vs read-only)** — converges with Piper #2/#6.
7. **`before_agent_start` persistent urgency banner + state** — transcript-safe form of Piper #7; survives abort/resume; clears on explicit ack.
8. **`model_select` escalation ladder** — converges with Piper #5.

**Convergence (Piper ∩ Muninn):** graduated tool-blocking, model escalation, persistent banner (use the `before_agent_start` form, not `transformContext`), abort-based stops. **Muninn-distinct:** pre-stream kill (#1), mid-stream token-monitor abort (#4), steer+abort combo (#5) — these add an *earliness axis* (abort before stream / mid-stream / at tool-boundary / at turn-end) my list didn't separate.

_(Huginn's collection pending; verify extension-vs-harness wiring of each hook during synthesis.)_

## Synthesis plan (when lists are in)

Funnel Huginn's + Muninn's collections into this note, dedupe, then design a **tiered urgency model** (cooperative → block-mutating → abort) grounded in the current-state audit. The north star: move from cooperative-only to a system that *can* act involuntarily when urgency demands, while leaving normal traffic on today's polite path.
