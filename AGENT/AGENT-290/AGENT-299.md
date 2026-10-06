---
title: "Standalone compiled app: Pi 1.0 Bun runtime setup parity"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-10-06T02:57:59.631Z
updated_at: 2026-10-06T20:30:59.962Z
depends_on:
  - AGENT-293
---

# Standalone compiled app: Pi 1.0 Bun runtime setup parity

The compiled standalone app skips Pi's src/bun/runtime-setup.ts. It already misses registerBunOAuthFlows() and setBedrockProviderModule(). Pi 1.0 adds setEmbeddedQuickJSWasmPath(), which is not a public export, and a codemode worker entrypoint, so codemode likely fails in the compiled app.

Decision (2026-10-06, Doug's rule: do what needs no Pi patch, skip what needs one):
- Wire the public parts: registerBunOAuthFlows() from @earendil-works/pi-ai/bun-oauth and setBedrockProviderModule() from @earendil-works/pi-ai/compat. Both are exported subpaths in Pi v1.0.4.
- Skip codemode in the compiled app. setEmbeddedQuickJSWasmPath() lives in coding-agent's config module, which its exports map does not expose, so wiring it needs a patch. Codemode is inactive unless enabled. If a no-patch way exists to keep it disabled in the compiled app, use it; otherwise document that it does not work there.

Done when: bun run test:standalone-app passes with a check that OAuth and Bedrock setup ran in the compiled binary, bun check is clean, and bun run test is green.

---

# Activity Log

## 2026-10-06T17:26:04.300Z

- **description**: 1 line → updated (7 lines)

## 2026-10-06T19:16:36.333Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-06T19:18:40.073Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-06T20:30:59.962Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
