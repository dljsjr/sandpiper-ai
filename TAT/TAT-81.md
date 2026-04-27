---
title: "Tattler socket/tmpfile bringup is not reload-aware (clobbers live session on /reload)"
status: NOT STARTED
kind: BUG
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-06-30T06:07:56.880Z
updated_at: 2026-06-30T06:07:56.880Z
---

# Tattler socket/tmpfile bringup is not reload-aware (clobbers live session on /reload)

On extension/resource reload (/reload), the Tattler tmpfile + Unix-domain socket bringup runs the same path as a cold start: it tries to bring everything up as a fresh session instead of detecting and reusing the existing live socket/tmpfile. Result: after a reload the agent's Tattler socket ends up dead — the agent is no longer reachable by peers until the session is fully restarted.

Observed 2026-06-30 by Doug: reloaded the reinforced-guidance extension cleanly, which also re-ran Tattler bringup; the live Tattler socket went dead afterward. Harmless while flying solo (a dead socket only bites when a peer tries to reach the agent), but it silently breaks agent-to-agent reachability for any multi-agent session that survives a reload.

Same bug family as the reinforced-guidance daemon restart issue (RG, commit 4b42e159): bringup code that only imagined ONE lifecycle (cold launch) and never the second one (reload). Likely fix shape is symmetric: on bringup, check for an existing socket/descriptor first — reuse if healthy, only tear down + rebuild if stale/dead. Make reload idempotent w.r.t. the Tattler socket/tmpfile rather than assume-fresh.

Repro: start a session with Tattler up, run /reload, then check whether the agent's Tattler socket is still live / the agent is still reachable by a peer.
