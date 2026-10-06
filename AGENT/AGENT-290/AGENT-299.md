---
title: "Standalone compiled app: Pi 1.0 Bun runtime setup parity"
status: NOT STARTED
kind: SUBTASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-10-06T02:57:59.631Z
updated_at: 2026-10-06T02:57:59.631Z
depends_on:
  - AGENT-293
---

# Standalone compiled app: Pi 1.0 Bun runtime setup parity

The compiled standalone app skips Pi's src/bun/runtime-setup.ts. It already misses registerBunOAuthFlows() and setBedrockProviderModule(). Pi 1.0 adds setEmbeddedQuickJSWasmPath(), which is not a public export, and a codemode worker entrypoint, so codemode likely fails in the compiled app. Investigate the supported way to provide these, decide between wiring them and disabling codemode in the compiled app, and add a compile-runtime test.
