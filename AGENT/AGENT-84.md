---
title: "Plan package-first multi-distribution refactor"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-04-27T18:20:52.924Z
updated_at: 2026-04-30T04:06:13.888Z
related:
  - AGENT-16
  - AGENT-82
  - TCL-111
---

# Plan package-first multi-distribution refactor

Plan the repository refactor from a Pi-package-oriented Sandpiper repo to a package-first monorepo with multiple distributions.

Work plan: `.sandpiper/docs/specs/package-first-multi-distribution.md`

Summary:
- Treat `packages/` as the long-term source of truth; root `extensions/`, `skills/`, `prompts`, and `themes` become generated/bridged distribution layout rather than canonical authored source.
- Produce three distributions:
  1. standalone Sandpiper CLI/app bundle with Sandpiper identity and `.sandpiper` config defaults;
  2. neutral Pi package with enhanced capabilities/resources but no Sandpiper identity/system prompt;
  3. Claude Code plugin using plugin resources plus stdio MCP adapters over neutral capability operations.
- Keep neutral capability code host-neutral: no hardcoded `.sandpiper`, `.pi`, `SANDPIPER_*`, Pi package-root assumptions, Pi tool definitions, or MCP tool definitions in core logic.
- Keep host adapters thin: Pi adapters own Pi extension/tool contracts; Claude adapters own MCP tool schemas/lifecycle/transport; neutral packages expose typed operations.

Implementation phases:
1. `AGENT-85` — standalone CLI spike using Pi `main(args, { extensionFactories })` and `resources_discover`.
2. `AGENT-86` — introduce host-context/path/config abstraction.
3. `AGENT-87` — split Sandpiper identity from neutral capabilities.
4. `AGENT-88` — move neutral capabilities/resources under `packages/`.
5. `AGENT-89` — add architecture invariant checks and distribution smoke tests.
6. `AGENT-90` — neutral Pi package distribution.
7. `AGENT-91` — standalone Sandpiper Bun app/binary distribution.
8. `AGENT-92` — Claude Code plugin distribution.
9. `AGENT-93` — retire legacy root Pi-package assembly after replacements are verified.

Guardrails:
- Behavior-preserving migration unless a task explicitly says otherwise.
- Add characterization tests before moving existing behavior.
- Do not delete legacy root resource directories until generated replacements are smoke-tested.
- Finish each phase with `bun check`, relevant tests, invariant searches, and distribution-specific smoke tests when applicable.

---

# Activity Log

## 2026-04-27T18:20:52.961Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-04-27T18:20:53.001Z

- **description**: added (12 lines)

## 2026-04-27T18:22:34.736Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-04-30T04:06:13.817Z

- **description**: 12 lines → updated (29 lines)

## 2026-04-30T04:06:13.889Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
