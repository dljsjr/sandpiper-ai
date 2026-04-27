---
title: "Research and build Claude Code plugin distribution"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-04-27T18:20:53.330Z
updated_at: 2026-05-04T20:51:22.715Z
depends_on:
  - AGENT-88
  - AGENT-89
related:
  - AGENT-84
---

# Research and build Claude Code plugin distribution

Research and build the Claude Code plugin distribution for neutral Sandpiper capabilities/resources.

See .sandpiper/docs/specs/package-first-multi-distribution.md.

Claude plugin reference findings to account for:
- plugins are self-contained directories with optional `.claude-plugin/plugin.json`
- skills map to `skills/`; selected prompt templates may map to `commands/` or skills after review
- plugin tools are exposed via plugin-provided MCP servers (`.mcp.json` or inline manifest), not Pi extension factories
- plugin adapters should use `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, and `CLAUDE_PLUGIN_OPTION_*` at the boundary
- marketplace-installed plugins are cached, so installed plugins cannot rely on path traversal outside plugin root

Completion signal:
- Claude plugin format and component mapping are documented
- supported resources and MCP tool adapters load in Claude Code or a faithful local validator
- unsupported Pi extension/hook concepts are explicitly documented

---

# Activity Log

## 2026-04-27T18:22:09.322Z

- **description**: added (1 line)

## 2026-04-27T18:25:23.440Z

- **description**: 1 line → updated (15 lines)

## 2026-05-04T18:04:46.540Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-05-04T19:57:28.045Z

- **status**: IN PROGRESS → COMPLETE
- **resolution**: DONE

## 2026-05-04T20:40:08.805Z

- **status**: COMPLETE → IN PROGRESS

## 2026-05-04T20:51:22.716Z

- **status**: IN PROGRESS → COMPLETE
