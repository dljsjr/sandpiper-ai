---
title: "Pi 0.84.0 version upgrade and capability adoption"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: UNASSIGNED
reporter: USER
created_at: 2026-08-06T20:41:29.829Z
updated_at: 2026-08-07T22:05:56.067Z
---

# Pi 0.84.0 version upgrade and capability adoption

Bump pinned @earendil-works/pi-coding-agent (+pi-tui/pi-ai) 0.80.7 -> 0.84.0 and adopt capabilities introduced in 0.80.8..0.84.0, per the 2026-08-06 changelog audit.

Exposure assessment (verified 2026-08-06): the monorepo has ZERO usage of the breaking provider/model surfaces (ModelRegistry, getApiKeyAndHeaders, ModelsStreamTransforms, AuthStorage, provider refresh contexts, RPC message_update, registerProvider). All provider-surface breakage lands on pi-claude-code-cli-provider, tracked separately by its own agent. Incubating extensions (navigator, pi-yaams, reinforced-guidance) also clean.

Key coupling surfaces to watch: before_agent_start systemPromptOptions rebuild (packages/core/src/system-prompt.ts), fullscreen TUI mode vs setWidget/setEditorComponent/custom renderers, session JSONL consumers (read-session-memories, standup).

Non-goals: remote-session client APIs (PiClient/CBOR/UDS transport, 0.84.0) are session client/server remoting (leases, snapshots, prompt control) - NOT agent-to-agent messaging; no bearing on the Tattler rework. Relevant future consumers: herdr, and any RPC-mode dependency (the protocol reads as the RPC successor). Mermaid/LaTeX rendering and scrollbarThumb theme color need no action (no shipped theme files).

CLOSED 2026-08-07. All 13 subtasks complete. Pinned pi 0.80.7 -> 0.84.0 with capability adoption, verified end to end.

Landed: AGENT-246 (typebox -> pi-ai re-export, eliminating a dual-instance skew nobody had noticed), AGENT-236 (the pin bump itself), AGENT-238 + AGENT-226 (both audit-identified hacks removed - the tui.children[1] chat-container reach-in deleted outright, the modelVisible content:'' fake replaced with entry renderers), AGENT-227 (shell_relay timeout validation), AGENT-239 (idle polling -> agent_settled), AGENT-241 (outputPad in custom renderers), AGENT-242 (PI_SESSION_* / AI_AGENT env alignment), AGENT-243 (compile-pathway hardening), AGENT-244 (event-bus bookkeeping simplification), AGENT-237 (post-bump verification sweep).

Reverted deliberately: AGENT-240 (constrainedSampling strict:'prefer') - adopted, then found to hard-fail on strict-supporting providers because pi gates on model capability without inspecting schema shape; reverted under AGENT-254 with the mechanism recorded, re-adoption tracked as AGENT-255 once the integration harness can validate strict schemas headlessly.

Closed WONTFIX: AGENT-219 (asset-path helpers - adopting them would have regressed the harness_docs block, since PI_PACKAGE_DIR is deliberately repointed at Sandpiper's own package dir), AGENT-245 (upstream ask, no longer ticketed per the new AGENTS.md rule).

Bugs found and fixed en route, none of which were in scope at the start: AGENT-248 (dumpSystemPrompt hung in every headless context), TCL-143 (trail's first auto_push failed without upstream tracking - only ever passed on machines with push.autoSetupRemote), AGENT-256 (chorus widget starving the fullscreen transcript). Plus a stale .turbo cache restoring 5-month-old dist content, which had been masquerading as distribution-invariant test failures.

Verification: full suite green, distribution green, system prompt byte-identical across the bump apart from the version string, session format compatible, fullscreen confirmed in live dogfood. Every change reviewed adversarially and independently reproduced before landing.

---

# Activity Log

## 2026-08-07T22:05:54.812Z

- **description**: 7 lines → updated (19 lines)

## 2026-08-07T22:05:55.601Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-08-07T22:05:56.070Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
