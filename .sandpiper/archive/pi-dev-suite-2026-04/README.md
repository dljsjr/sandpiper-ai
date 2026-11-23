# Pi Extension Developer Documentation Suite

**Version**: Pi 0.67.3  
**Created**: 2026-04-16  
**Purpose**: Comprehensive guide for Pi extension and SDK developers

---

## Start Here

1. **[PI-DEV-ROUTING.md](./PI-DEV-ROUTING.md)** ← **Begin here** to find the right document for your task

---

## Document Index

### Getting Started
- [PI-DEV-QUICKSTART.md](./PI-DEV-QUICKSTART.md) - First extension in 15 minutes
- [PI-DEV-ROUTING.md](./PI-DEV-ROUTING.md) - Find the right doc for your task

### Core Concepts
- [PI-DEV-ARCHITECTURE.md](./PI-DEV-ARCHITECTURE.md) - Pi internals, loading, event flow
- [PI-DEV-EVENTS.md](./PI-DEV-EVENTS.md) - Complete event reference (25+ events)

### Building Extensions
- [PI-DEV-TOOLS.md](./PI-DEV-TOOLS.md) - Custom tools, rendering, truncation
- [PI-DEV-UI.md](./PI-DEV-UI.md) - TUI components, overlays, dialogs
- [PI-DEV-STATE.md](./PI-DEV-STATE.md) - State persistence, branching
- [PI-DEV-PROVIDERS.md](./PI-DEV-PROVIDERS.md) - Custom providers, OAuth, streaming

### Advanced Topics
- [PI-DEV-PATTERNS.md](./PI-DEV-PATTERNS.md) - Best practices, anti-patterns
- [PI-DEV-SECURITY.md](./PI-DEV-SECURITY.md) - Safety, validation, sandboxing
- [PI-DEV-ADVANCED.md](./PI-DEV-ADVANCED.md) - Subagents, games, SSH, file watching

### Programmatic Usage
- [PI-DEV-SDK.md](./PI-DEV-SDK.md) - SDK, AgentSession, runtime management

---

## Quick Reference

### I want to...

| Task | Read |
|------|------|
| Create first extension | [PI-DEV-QUICKSTART](./PI-DEV-QUICKSTART.md) |
| Understand event system | [PI-DEV-EVENTS](./PI-DEV-EVENTS.md) |
| Build custom tool | [PI-DEV-TOOLS](./PI-DEV-TOOLS.md) |
| Create custom UI | [PI-DEV-UI](./PI-DEV-UI.md) |
| Persist state | [PI-DEV-STATE](./PI-DEV-STATE.md) |
| Integrate provider | [PI-DEV-PROVIDERS](./PI-DEV-PROVIDERS.md) |
| Use SDK | [PI-DEV-SDK](./PI-DEV-SDK.md) |
| Follow best practices | [PI-DEV-PATTERNS](./PI-DEV-PATTERNS.md) |
| Build safety features | [PI-DEV-SECURITY](./PI-DEV-SECURITY.md) |
| Advanced techniques | [PI-DEV-ADVANCED](./PI-DEV-ADVANCED.md) |

---

## Source References

All source references use `$PI_CODING_AGENT_PACKAGE` which resolves to:
```
~/.local/share/mise/installs/npm-mariozechner-pi-coding-agent/0.67.3/node_modules/@mariozechner/pi-coding-agent
```

### Key Source Files

| File | Purpose |
|------|---------|
| `$PI_CODING_AGENT_PACKAGE/dist/core/agent-session.js` | Event flow, tool execution |
| `$PI_CODING_AGENT_PACKAGE/dist/core/extension-runtime.js` | Extension loading, API |
| `$PI_CODING_AGENT_PACKAGE/dist/core/resource-loader.js` | Resource discovery |
| `$PI_CODING_AGENT_PACKAGE/dist/core/session-manager.js` | Session persistence |
| `$PI_CODING_AGENT_PACKAGE/dist/core/model-registry.js` | Models, OAuth |

---

## Examples

All examples are at:
```
$PI_CODING_AGENT_PACKAGE/examples/
├── extensions/    # 70+ extension examples
└── sdk/           # 13 SDK examples
```

---

## Version History

| Date | Change |
|------|--------|
| 2026-04-16 | Initial suite creation |

---

**Next Step**: Read [PI-DEV-ROUTING.md](./PI-DEV-ROUTING.md) to find the right document for your current task.

---

## Changelog

### 2026-04-16 - Pi 0.67.4 Updates

**Added**:
- `after_provider_response` event hook (PI-DEV-EVENTS.md)
- `renderShell: "self"` for custom tool rendering (PI-DEV-TOOLS.md)
- `--no-context-files` CLI flag (PI-DEV-SDK.md)
- `loadProjectContextFiles()` utility export (PI-DEV-SDK.md)

**Also incorporated from 0.65.0-0.67.3**:
- `AgentSessionRuntime` for session replacement (PI-DEV-SDK.md)
- `defineTool()` helper with type inference (PI-DEV-TOOLS.md)
- `ctx.signal` for cancellation forwarding (PI-DEV-SDK.md)
- Updated `session_start` event with `reason` field (PI-DEV-EVENTS.md)

### 2026-04-16 - Initial Suite Creation

Created comprehensive Pi developer documentation suite with 14 documents covering all aspects of extension development, SDK usage, and Sandpiper-specific patterns.

