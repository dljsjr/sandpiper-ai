---
title: "Split neutral-capability extension bundle; rename identity to sandpiper-core"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-07-10T21:57:56.572Z
updated_at: 2026-07-10T21:57:57.026Z
related:
  - AGENT-228
---

# Split neutral-capability extension bundle; rename identity to sandpiper-core

Follow-up to AGENT-228's InlineExtension naming work. Doug: the generic <inline:1>/<inline:2> labels were only the first half of the cleanup.

1. Renamed the sandpiper-identity inline extension label to sandpiper-core in packages/cli/sandpiper_resources.ts (Doug's explicit call).

2. Split createNeutralCapabilityExtension (one factory bundling 5 registrations: skill loading, turn control, context management, background-process tools, background-process lifecycle) into 4 separately-loadable extensions, matching the granularity web_fetch/web_search/autotoon/tattler/chorus already have: createSkillLoadingExtension, createTurnControlExtension, createContextManagementExtension, createBackgroundProcessExtension (tools+lifecycle stay paired -- they share one ProcessManager instance and are two halves of one capability, not two capabilities). Registration logic stays colocated in extensions/system/neutral-capability-extension.ts per Doug's explicit 'colocate for organization, load separately' framing; only the loading/wiring layer became granular.

Applied at both loading surfaces:
- plugins/pi/extensions/ (the neutral Pi adapter surface): deleted capabilities.ts + capabilities.test.ts, added skill-loading.ts, turn-control.ts, background-process.ts, and wired in context-management.ts -- which already existed as an orphaned, never-registered thin adapter, an abandoned half-finished attempt at this exact split found during the work. Updated package.json's pi.extensions manifest to list all 4 individually.
- packages/cli/sandpiper_resources.ts (standalone distribution's InlineExtension array): replaced the single sandpiper-neutral-capability entry with 4 separately-named entries (skill-loading, turn-control, context-management, background-process).

extensions/system's single-package bundle (createSandpiperSystemExtension, used by extensions/system/index.ts and extensions/system.ts for the full non-standalone distribution) intentionally still composes everything into one registration -- it's genuinely one cohesive package.json pi.extensions entry in that distribution, not the thing Doug was pointing at.

Verified: check:tsc clean, check:biome-check clean on all touched/new files, devtools/rootPiPackageSmoke.test.ts (exercises the plugins/pi/extensions manifest end-to-end through Pi's real extension loader) passes, all extensions/system/*.test.ts pass, packages/cli/sandpiper_resources.test.ts and standalone_resource_discovery.test.ts pass (same pre-existing unrelated shell-relay failure noted in AGENT-228 persists, confirmed not touched by this change).

---

# Activity Log

## 2026-07-10T21:57:56.785Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-07-10T21:57:57.027Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
