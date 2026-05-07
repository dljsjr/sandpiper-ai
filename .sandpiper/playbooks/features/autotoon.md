---
name: AutoTOON
read_when: AutoTOON, JSON to TOON, token optimization, tool_result conversion, capability-autotoon, Claude Code AutoTOON hook, autotoon extension
---

# AutoTOON

Read this before changing JSON→TOON conversion or AutoTOON adapters.

## Key Rules

- The host-neutral transform source of truth is `packages/capability-autotoon/src/core.ts`.
- Pi adapter behavior lives in `packages/capability-autotoon/src/pi-extension.ts`.
- Claude Code hook behavior lives in `packages/adapter-claude-code/src/autotoon-post-tool-use.ts`.
- `extensions/autotoon/autotoon.ts` is a compatibility bridge, not the implementation home.
- Keep prompt/capability guidance separate from conversion unless the task explicitly reintroduces guidance injection.
- Preserve size gates and length-guard behavior unless tests are updated to cover the change.

## References

- Public feature overview: `docs/features/autotoon.md`
- Technical architecture: `docs/features/autotoon-architecture.md`
- Package README: `packages/capability-autotoon/README.md`
