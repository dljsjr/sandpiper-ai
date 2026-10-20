---
title: "Replace the internal Parallel MCP client with the standalone Pi client"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-11-03T01:50:55.871Z
updated_at: 2026-11-09T19:42:59.232Z
related:
  - TOOLS-99
  - TOOLS-92
---

# Replace the internal Parallel MCP client with the standalone Pi client

## Final compatibility correction

A fourth autonomous RED/GREEN cycle preserves old timeout normalization: positive finite milliseconds truncate/cap at2^31-1, invalid/nonpositive values keep the old60s fallback. Six expected failures proved native unbounded/overflow differences before minimal fix.18real-SDK transport cases now cover the full adapter, plus14parser/provider baseline. Corrected main and new clean-source default check/full86files671tests/pack all PASS with original test timeouts and zero warnings. No code changes planned absent independent review. Earlier12case/665test results below are pre-correction history.

## Adapter handoff evidence

Native standalone client now replaces the application runtime import, with no host MCP configuration/server-tool registration. Same query/count/parser/provider/clientInfo/application session_id contract. Three autonomous RED/GREEN cycles: forbidden retired runtime -> real native wire/output; native30s initialize regression -> existing60s budget; stalled initialized-notification ->60s guard, abort and joined best-effort close. Permanent tests use real pinned SDK and fake HTTP only.12 transport cases plus14 existing parser/provider tests pass (3files26tests), full tsc and scoped Biome pass. No user cancellation feature added, no live provider or real configuration used. Shared build/pack/fresh-install/independent review remain under102 after101 handoff.

## Approved scope

User explicitly approved adoption as part of current overall simplification, with no deferral. Replace only mcporter library usage behind our own web_search facade with public @earendil-works/pi-mcp1.3.0. Preserve endpoint, provider selection, query/count mapping, stable application session_id, own tool/schema/result/error wrapper, anonymous Streamable HTTP path and15s tool-call bound. Keep upstream tools unregistered and avoid host MCP configuration/auth/cache. Handle connection/initialized-notification stalls and best-effort cleanup without new public flags or user-cancellation features. Autonomous one-behavior RED/GREEN cycles, real SDK plus hermetic transport fixtures. No live providers, user configuration, MCP server tool exposure, developer CLI removal, Shell Relay/Trail/SOP/archive/WIP changes.

---

# Activity Log

## 2026-11-03T01:50:56.110Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-03T02:17:48.759Z

- **description**: 1 line → updated (7 lines)

## 2026-11-03T02:17:48.824Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-03T03:06:08.366Z

- **description**: 7 lines → updated (11 lines)

## 2026-11-09T19:42:59.234Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
