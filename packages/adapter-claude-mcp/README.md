# sandpiper-adapter-claude-mcp

Claude Code stdio MCP adapter for neutral Sandpiper capabilities.

This package owns Claude/MCP-specific tool names, descriptions, schemas, result metadata, and stdio transport wiring. Host-neutral behavior stays in capability packages such as `sandpiper-capability-autotoon`.

## Current tools

| Tool | Backing capability |
| --- | --- |
| `convert_json_to_toon` | `sandpiper-capability-autotoon` core |

## Verification

```bash
bun --filter sandpiper-adapter-claude-mcp test
bun --filter sandpiper-adapter-claude-mcp build
bun run test:claude-plugin
```
