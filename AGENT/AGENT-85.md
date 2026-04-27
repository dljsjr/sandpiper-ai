---
title: "Spike standalone Sandpiper CLI using Pi main extension factories"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-04-27T18:20:53.043Z
updated_at: 2026-04-29T04:34:17.544Z
depends_on:
  - AGENT-84
related:
  - AGENT-84
---

# Spike standalone Sandpiper CLI using Pi main extension factories

Spike a minimal standalone Sandpiper CLI entrypoint using Pi 0.70.x main(args, { extensionFactories }) support before broad file movement.\n\nSee .sandpiper/docs/specs/package-first-multi-distribution.md.\n\nCompletion signal:\n- minimal Sandpiper entrypoint runs against temp config state\n- at least one bundled/inline extension factory loads without root pi.extensions\n- at least one bundled skill/resource path loads without root pi.skills\n- bun compile/app-bundle asset constraints are documented

---

# Activity Log

## 2026-04-27T18:22:09.055Z

- **description**: added (1 line)

## 2026-04-27T18:43:23.402Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-04-27T18:53:56.367Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-04-29T04:34:17.544Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
