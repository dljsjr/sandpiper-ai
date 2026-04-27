---
title: "Grounding + design proposal for the integration harness"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: "sandpiper-0.84-dev"
reporter: AGENT
created_at: 2026-08-07T14:57:56.314Z
updated_at: 2026-08-07T15:14:41.553Z
---

# Grounding + design proposal for the integration harness

Grounding + design proposal, BEFORE any harness code. Deliverable is a written design to the coordinator, not an implementation.

Ground against the real 0.84.0 package (binary --help output and parse-args source, not docs-from-memory):
1. Extension-selection CLI surface: exact flags for disabling all extensions (--no-extensions confirmed to exist) and for loading a SPECIFIC extension file/dir (verify -e/--extension or equivalent, and whether it composes: multiple flags, path forms, package-manifest interaction). This is the enabler for isolated/combinatoric per-extension runs - if per-extension selection does NOT exist upstream, the design must say so and propose the fallback (e.g. a minimal test package.json per combination) rather than assuming.
2. RPC mode: full command/event inventory from docs/rpc.md + rpc-entry source; confirm the delta-only message_update shape; identify how tool calls/results surface as events (needed for asserting extension tool behavior); check the Compaction and Bash command groups for test-driver usefulness.
3. Deterministic turns: evaluate mock-provider options - (a) full provider extension registration (0.81.0 feature) with a scripted provider; (b) the inherited faux-provider support mentioned in the 0.84.0 deferred-response contracts changelog entry; (c) blackholed provider + error-path-only assertions (weakest, current AGENT-248-era pattern). Recommend one primary mechanism with evidence it can script multi-turn tool-calling conversations.
4. Harness placement + wiring given the root-vitest nested-config gap: where the harness lives, how env defaults are enforced (single shared helper all integration tests must go through - isolation-by-construction, not per-test discipline), how it coexists with test:vitest gates and turbo.
5. Scope cut for wave 1: propose 2-3 extensions for first coverage with rationale (candidates: skill tool - pure/no external deps; autotoon - tool_result transform observable via RPC events; background-process - timing/notification semantics; tattler - UDS messaging, two-process potential; EXCLUDED from wave 1: shell-relay (needs zellij), web-fetch/web-search live paths (network - though their mock adapters may allow inclusion)).

Report the design to the coordinator for approval before AGENT-251 begins.

---

# Activity Log

## 2026-08-07T14:58:27.852Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → sandpiper-0.84-dev

## 2026-08-07T15:10:29.190Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-08-07T15:14:41.554Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
