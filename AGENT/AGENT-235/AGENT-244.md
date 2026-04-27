---
title: "Simplify event-bus listener bookkeeping if 0.84.0 disposal makes it redundant"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: LOW
assignee: "sandpiper-0.84-dev"
reporter: AGENT
created_at: 2026-08-06T20:42:18.656Z
updated_at: 2026-08-07T02:58:58.250Z
depends_on:
  - AGENT-236
---

# Simplify event-bus listener bookkeeping if 0.84.0 disposal makes it redundant

0.84.0 (#7656) fixed extension event-bus listeners surviving session reloads and disposal. Tattler (eventResponderUnsubscribers), chorus (eventUnsubscribers), and startup-hooks (resetPromptContributionListener) hand-manage unsubscribers partly because of that leak. Verify the new disposal semantics, then simplify what is redundant. CAUTION: our bookkeeping is per-session (session_start/session_shutdown) while Pi disposal is per-extension-runtime - do not delete blindly.

Related side-finding to investigate while in there: chorus registers its room-post event responders at extension load, clears them on session_shutdown, and never re-registers on session_start - so after /new, opening a room may leave requestChorusRoomPost unanswered (editor posts time out). Pre-existing, not 0.84.0-related.

## Investigation (2026-08-07)

Mechanism confirmed by reading pi source directly: `runtime.trackEventBusSubscription()` (loader.js:138-183) wraps every `pi.events.on()` call in an idempotent, tracked unsubscribe. `runtime.invalidate()` — called from `AgentSession.dispose()` (agent-session.js:567) and from `AgentSession.reload()` (agent-session.js:2056, right after `session_shutdown` fires on the old runner) — walks that tracked set and unsubscribes everything automatically, at the exact same lifecycle boundary our manual bookkeeping targets.

Traced every session-replacement path this repo actually uses (nothing in this repo builds its own AgentSession/ResourceLoader — Sandpiper rides pi's own CLI bootstrap entirely, standalone app included): pi's main.js `createRuntime` closure, which every new/resume/fork session-replacement funnels through, builds a brand-new `DefaultResourceLoader` (agent-session-services.js:60-64) on every call — brand-new eventBus, brand-new runtime, full extension factory reload. The old eventBus/runtime simply become garbage. `/reload` is the one path that reuses the *same* ResourceLoader+eventBus in place (`resource-loader.js`'s `reload()` never recreates `this.eventBus`) — that was the real pre-0.84.0 leak vector, and `invalidate()` now auto-cleans it before extensions re-register.

**Side-finding: FALSIFIED.** Wrote a two-scenario repro directly against chorus's factory (extensions/chorus.test.ts, describe block "Chorus event-responder lifecycle across session boundaries (AGENT-244)"): (1) same-bus reload — session_shutdown clears listeners, factory reruns on the same events bus, responder answers again; (2) fresh-bus /new — old bus torn down and abandoned, factory reruns against a brand-new bus, responder answers there. Both pass. Mechanism: `loadExtension()`/`loadExtensionFromFactory()` unconditionally call `factory(api)` on every load, and every session-replacement path in this repo triggers a full extension reload (either via /reload's in-place `resourceLoader.reload()`, or via /new|resume|fork's brand-new ResourceLoader from `createRuntime`) — so chorus's factory-load-time (not session_start-gated) registration is re-established every time regardless. No code changed for this finding; nothing to fix.

**Per-site audit for non-unsubscribe side effects** (unsubscribe-redundancy is not handler-redundancy):
- tattler/index.ts session_shutdown: `clearEventResponders()` is pure unsubscribe (redundant with invalidate()) — removed. `pendingInbox.clear()`, `pendingInboxNotifier.reset()`, `activeContext = undefined`, and the UDS socket/server teardown are real per-session resource/state resets, unrelated to event-bus unsubscription — left untouched. The session_start-top `clearEventResponders()` call is kept as a cheap, idempotent, defensive guard against any future same-bus double-start path Pi might introduce.
- chorus.ts session_shutdown: `clearEventListeners()` is pure unsubscribe (redundant with invalidate()) — removed. `ownIdentityRequest = undefined` and `void stopActiveRoom()` are real state/resource teardown, unrelated to event-bus unsubscription — left untouched. The factory-entry-top `clearEventListeners()` call (chorus's equivalent of a defensive entry-time clear, since chorus has no session_start hook) is kept for the same reason as tattler's.
- startup-hooks.ts session_shutdown: `resetPromptContributionListener()` bundles the pi.events unsubscribe with `promptContributions.reset()` (collector state — semantic, not leak-prevention). Left entirely untouched: unbundling the unsubscribe from the semantic reset for a LOW-priority simplification task is not worth the added coupling-change risk, and the existing call is not incorrect, just partially redundant.

Diff lands as a single commit; see reviewer submission for hashes.

---

# Activity Log

## 2026-08-07T00:43:45.082Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → sandpiper-0.84-dev

## 2026-08-07T02:53:27.961Z

- **description**: 3 lines → updated (18 lines)

## 2026-08-07T02:54:56.056Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-08-07T02:58:58.251Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
