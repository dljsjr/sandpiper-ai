---
title: "Fix knip.jsonc project-scope gap hiding extensions/ dead code"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-07-10T18:21:58.504Z
updated_at: 2026-07-10T18:21:58.966Z
---

# Fix knip.jsonc project-scope gap hiding extensions/ dead code

Discovered while investigating why sendChorusSelfMessageToChatWhenIdle wasn't flagged by 'bun run check:knip:production'. Root cause: knip.jsonc's root workspace project field was overridden to just 2 devtools files (Knip project values override, not merge, with defaults), so extensions/*.ts loose files and extensions/chorus/, extensions/tattler/ subdirectories (anything under extensions/ without its own package.json workspace) were entirely unscanned for unused exports/files, in both default and --production knip modes. Fixed by adding bang-suffixed project patterns (extensions/*.ts!, extensions/chorus/**/*.ts!, extensions/tattler/**/*.ts!) to the root workspace, and adding extensions/system.ts! as an entry pattern (it's a real distribution entrypoint referenced only from devtools/distPackageJson.ts's string list, which knip's import-graph analysis can't trace — was showing as a false-positive unused file). Verified via a live GitHub issue (webpro-nl/knip#1374) confirming the bang-suffix is a 'declare production scope' marker, not an exclusion marker.

Fixing the scope gap surfaced 8 confirmed-dead Tattler/Chorus exports, cross-checked with Huginn and Muninn (agents who did the original in-flight refactor work) over Tattler before removal:
- sendChorusSelfMessageToChatWhenIdle (chorus.ts) — superseded by TAT-62/63 idle/batched message unification
- createChorusUserMessageContent (chorus/chorus-runtime.ts) — superseded by createTattlerPendingBatchContent per TAT-80 envelope slimming
- roomPostToDelivery (tattler/tattler-pi-events.ts) and createChorusRoomDelivery (tattler/tattler-protocol.ts) — pre-unification pair superseded by createChorusRoomDeliveryFrame
- announceChorusReady / onChorusReady / requestChorusReady / onChorusReadyRequest (tattler/tattler-pi-events.ts) — TAT-16's readiness/request state-machine, never wired into chorus.ts's unconditional /chorus registration; confirmed via Huginn (dogfooded live multi-agent Chorus since 2026-05-25 on the unconditional path, zero load-order bugs) that Doug explicitly decided to drop rather than finish

Explicitly left alone (confirmed in-flight, not dead) per both agents: extensions/tattler/tattler-room-log.ts (TAT-71, storage-only by design, waiting on TAT-72/73/74).

---

# Activity Log

## 2026-07-10T18:21:58.796Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-07-10T18:21:58.968Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
