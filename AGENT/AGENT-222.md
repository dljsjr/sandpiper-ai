---
title: "Mark skill tool as parallel-safe via executionMode"
status: COMPLETE
resolution: WONTFIX
kind: TASK
priority: LOW
assignee: "Piper"
reporter: USER
created_at: 2026-06-30T03:57:44.369Z
updated_at: 2026-06-30T04:13:35.322Z
---

# Mark skill tool as parallel-safe via executionMode

Pi's ToolDefinition supports an executionMode field ('sequential' | 'parallel'). The skill tool registered by extensions/system/skill-loading-tool.ts is read-only and side-effect-free except for best-effort sqlite metrics writes; it is parallel-safe.

Change:
- Add `executionMode: 'parallel'` to the ToolDefinition literal in registerSkillLoadingTool (extensions/system/skill-loading-tool.ts).

Verification:
- Extend extensions/system/skill-loading-tool.test.ts with an assertion that the registered tool declares executionMode === 'parallel'.
- bun run check:vitest -- extensions/system/skill-loading-tool.test.ts passes.
- bun check stays clean.

Out of scope:
- Touching any other tool's executionMode.
- Refactoring skill-loading-tool.ts beyond the one-line addition and test.

---

# Activity Log

## 2026-06-30T04:01:32.093Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → Piper

## 2026-06-30T04:13:35.322Z

- **status**: IN PROGRESS → COMPLETE
- **resolution**: WONTFIX
