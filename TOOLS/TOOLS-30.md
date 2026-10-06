---
title: "Simplify the build and distribution system after the Pi 1.0 migration"
status: NOT STARTED
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-10-06T20:03:05.349Z
updated_at: 2026-10-06T20:03:05.349Z
---

# Simplify the build and distribution system after the Pi 1.0 migration

Simplify Sandpiper's build and distribution system after the Pi 1.0 migration (AGENT-290). Doug deferred this until the migration is done (2026-10-06).

Starting input: .sandpiper/docs/specs/agent-301-build-topology-proposal.md (in the pi1 workspace until AGENT-290 merges). Items carried over from AGENT-301, which did D and E:
- A. dist/ plays two roles: the npm CLI (Pi in dependencies) and a Pi package (`pi` manifest), which Pi 1.0 warns about. Proposal: CLI-only dist/; stock Pi loads Sandpiper from the repository root.
- B. Exact host peers in the Pi-package manifests (repository root, plugins/pi/extensions) block installs into other Pi versions; Pi asks for "*". Proposal: "*" peers there as a named Syncpack exception.
- C. The local Pi patch reaches repository runs and the compiled app only, not an npm-installed sandpiper-ai. Record it in docs/dev/build-system.md.

Decide A and B as part of the wider simplification, not in isolation.
