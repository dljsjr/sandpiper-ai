---
title: "Bump Sandpiper to Pi 1.3.0"
status: NOT STARTED
kind: TASK
priority: HIGH
assignee: UNASSIGNED
reporter: USER
created_at: 2026-10-16T17:04:57.428Z
updated_at: 2026-10-16T17:04:57.428Z
related:
  - AGENT-306
  - AGENT-290
---

# Bump Sandpiper to Pi 1.3.0

Move Sandpiper from Pi 1.0.4 to 1.3.0. Findings and decisions are in AGENT-306; read its description first.

Steps:
1. Bump every @earendil-works/pi-* pin to 1.3.0 (root, packages/cli, extensions/*, plugins/pi/extensions); bun install; bun run check:deps; fix type errors. BeforeAgentStartEvent is now a union on messageType.
2. Redo the local patch (follow "Local Pi patch" in docs/dev/build-system.md). Drop the Shape B part of agent-session.js (fixed upstream in 1.2.0, #10739). Keep the system-prompt.js part that keeps tools/rules under customPrompt. Strip any .bun-tag-* entries.
3. Update extensions/system/prompt-ownership.test.ts: the first-turn-gap test now expects the Sandpiper prompt. All other prompt invariants must still hold, with only the tools/rules patch applied.
4. Add a Tattler test for 1.2.0's busy-during-setup window: a message arriving during before_agent_start must not sit undelivered in the pending inbox.
5. Compiled app: add autoloadDotenv: false in devtools/standaloneSandpiperApp.ts (unless TOOLS-30 has dropped the compiled app).
6. Remove the mitsuhiko notify package from Doug's ~/.sandpiper/agent/settings.json (Pi's OSC 7501 program status replaces it). This is Doug's config: confirm first.
7. Check Chorus's custom editor live in fullscreen (1.2.0 cursor markers).

Done when: bun check is clean; bun run test is green, including devtools/npmPackageInstallSmoke.test.ts, which fails on 1.0.4 because of an upstream ^ range; the distribution gate passes; and a live Sandpiper session on 1.3.0 with Doug's settings shows the Sandpiper prompt plus tools/rules/cwd and survives a Tattler wake.

Not in scope: renderer padding and theme-color cleanup (audit notes on AGENT-306), and other adoption candidates.
