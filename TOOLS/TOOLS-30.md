---
title: "Simplify the build and distribution system after the Pi 1.0 migration"
status: NOT STARTED
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-10-06T20:03:05.349Z
updated_at: 2026-10-06T20:39:14.944Z
---

# Simplify the build and distribution system after the Pi 1.0 migration

Simplify Sandpiper's build and distribution system after the Pi 1.0 migration (AGENT-290).

Background, from two earlier sessions:
- 2026-10-05 (AGENT-289/TOOLS-27 session): Doug pointed out that cleaning must be recursive because the build creates nested dist dirs. We agreed to freeze the 0.85 build and defer build-layout and clean redesign, since Pi 1.0 might change the machinery. The agent's sketch then was to keep package-owned output beside each package and treat the root dist/ as staging, not to flatten everything.
- 2026-10-06 (AGENT-290 planning session): Doug said Sandpiper carries a lot of technical debt from delivering itself several ways: Pi package, uncompiled standalone, compiled Bun standalone, and Claude Code plugin/extensions. Nobody else uses them, and Doug uses only the uncompiled standalone. The long-term plan is his own ground-up harness.

So the simplification is mainly about which delivery modes to keep, with the build reshaped around them. Questions carried over from AGENT-301 (proposal: .sandpiper/docs/specs/agent-301-build-topology-proposal.md), which may become moot once delivery modes are chosen:
- A. dist/ is both the npm CLI (Pi in dependencies) and a Pi package (`pi` manifest), which Pi 1.0 warns about.
- B. Exact host peers in the Pi-package manifests (repository root, plugins/pi/extensions) block installs into other Pi versions; Pi asks for "*".
- C. Done 2026-10-06: where the local Pi patch applies (repository runs, generated dist/, the compiled app; not an npm install) is documented under "Local Pi patch" in docs/dev/build-system.md, together with the steps to redo it on a Pi bump.

Already done under AGENT-301: Pi asset copy narrowed to the three directories Pi resolves (8.6 MB to 1.2 MB); clean.ts removes .turbo, recurses without a depth limit, and never follows symlinks.

---

# Activity Log

## 2026-10-06T20:04:35.002Z

- **description**: 8 lines → updated (12 lines)

## 2026-10-06T20:39:14.945Z

- **description**: updated
