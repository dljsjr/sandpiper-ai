# sandpiper-adapter-claude-code

Claude Code adapter hooks over neutral Sandpiper capabilities.

This package owns Claude-specific hook configuration/entrypoint behavior. Host-neutral behavior stays in capability packages such as `sandpiper-capability-autotoon`.

## Current hooks

| Hook | Backing capability |
| --- | --- |
| `PostToolUse` AutoTOON output rewrite | `sandpiper-capability-autotoon` core |

## Verification

```bash
bun --filter sandpiper-adapter-claude-code test
bun --filter sandpiper-adapter-claude-code build
bun run test:claude-plugin
```
