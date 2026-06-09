# AGENT-35 Deterministic Tool-Use Enforcement — Technical Spec

- **Diátaxis mode**: Reference spec
- **Status**: Draft
- **Ticket**: AGENT-35
- **Date**: 2026-06-10
- **Primary implementation area**: Sandpiper system extension / skill-loading tool

---

## Overview

Deterministic tool-use enforcement blocks selected high-confidence tool operations unless the required catalog skill has been loaded in the current session.

The MVP uses Pi's `tool_call` event. It does not inject guidance. It does not track arbitrary playbook reads. It does not enforce `shell_relay`.

## Grounded Pi Capabilities

Pi extension docs define the required interception surface:

- `pi.on("tool_call", handler)` fires after `tool_execution_start` and before the tool executes.
- Returning `{ block: true, reason?: string }` blocks execution.
- `event.toolName` identifies the tool.
- `event.input` contains tool arguments and is mutable.
- `isToolCallEventType("bash", event)` narrows the input type; for `bash`, input is `{ command: string; timeout?: number }`.
- `read`, `write`, and `edit` tool calls expose structured file/path arguments. Phase 0 must verify the exact argument names from the active Sandpiper tool schemas before detectors hard-code them.
- `user_bash` is a separate event for user `!` / `!!` commands. MVP policy applies to agent tool calls, not user shell commands.
- `pi.appendEntry(customType, data)` persists extension state in the session without adding it to LLM context.
- `/skill:name` slash-command expansion happens in the input pipeline. MVP loaded-skill state is based on the Sandpiper `skill` tool only unless that slash-command path is explicitly wired.

## Components

### 1. Loaded Skill Registry

The registry answers: has catalog skill `<name>` been loaded in this session?

Current Sandpiper state:

- `systemPromptOptions.skills` / `<available_skills>` is discovery metadata, not loaded-skill state.
- `extensions/system/skill-loading-tool.ts` routes successful skill loads through `executeSkillTool()`.
- After successful load, the current code calls `recordSkillActivationSafely({ name, source })`.
- The existing default recorder writes aggregate counts to `~/.sandpiper/agent/skill_metrics.sqlite3` and is not live session policy state.

Required MVP behavior:

- Add a live in-memory loaded-skill registry in the system extension layer.
- Update it only after successful Sandpiper `skill` tool execution.
- Treat `/skill:name` slash-command expansion as out of scope / not policy-satisfying unless implementation explicitly hooks that path.
- Persist enough state with `pi.appendEntry()` to survive reload/resume within a session. Current skill-loading glue may need wider extension dependencies or tool execution context access to call `appendEntry()`; do not assume persistence is already wired.
- Restore state on `session_start` by scanning prior custom entries.
- Expose a simple in-process query API for policy evaluation.

Example shape:

```ts
interface LoadedSkillRegistry {
  markLoaded(skill: LoadedSkillRecord): void;
  isLoaded(name: string): boolean;
  listLoaded(): LoadedSkillRecord[];
}

interface LoadedSkillRecord {
  name: string;
  source: "catalog" | "filesystem";
  loadedAt: string;
}
```

Only catalog skill preconditions are in MVP. Filesystem skill loads may be recorded for telemetry but should not satisfy named catalog-skill policies unless explicitly mapped.

### 2. Tool Policy Evaluator

The evaluator receives a Pi `tool_call` event and the loaded-skill registry. It returns one of:

```ts
type ToolPolicyDecision =
  | { action: "allow" }
  | { action: "reject"; reason: string }
  | { action: "observe"; reason: string; details?: unknown };
```

MVP can use plain TypeScript policy objects. Do not build a DSL until repeated rules prove the shape.

```ts
interface ToolPolicy {
  name: string;
  evaluate(
    event: ToolCallEvent,
    context: ToolPolicyContext,
  ): ToolPolicyDecision;
}

interface ToolPolicyContext {
  loadedSkills: LoadedSkillRegistry;
}
```

`observe` is internal telemetry. It must not block execution and need not be agent-visible.

### 3. Detector Confidence

Only high-confidence detectors may reject.

MVP detector classes:

| Detector                      | Input surface                                | May reject?                      | Notes                                 |
| ----------------------------- | -------------------------------------------- | -------------------------------- | ------------------------------------- |
| Structured path detector      | `read` / `write` / `edit` file path argument | Yes                              | Structured argument, no shell parsing |
| Conservative command detector | `bash.command` direct simple command         | Yes, only for exact direct forms | Refuse to match ambiguous shell       |

Future detector classes:

| Detector                 | Input surface         | May reject?     | Notes                                |
| ------------------------ | --------------------- | --------------- | ------------------------------------ |
| PATH shim / wrapper      | Executable resolution | Yes after spike | Catches subprocess-by-name; post-MVP |
| Shell text heuristic     | Opaque shell string   | No              | Observe only                         |
| Opaque subprocess/script | Unknown               | No              | Out of MVP                           |

### 4. MVP Policies

#### `jj_requires_jj_skill`

Reject high-confidence direct `jj` invocations in the standard `bash` tool unless `jj` skill is loaded.

Initial detector accepts simple direct `jj` invocations, for example:

```text
jj status
jj log
  jj diff
```

Match `jj` as the leading command token with any arguments. The listed subcommands are examples, not an allowlist.

The detector may optionally accept a narrow literal `cd <path> && jj ...` grammar after tests prove it is false-positive-safe. It must reject shell features it cannot statically understand:

- variable command names: `$TOOL status`
- command substitution: `$(echo jj) status`
- pipelines and redirections where command identity is ambiguous
- nested `bash -c`, `python`, `node`, `bun`, or script-mediated invocations

Those cases are not MVP enforcement targets. They are accepted leakage for a behavior guardrail.

Rejection text:

```text
Blocked by Sandpiper tool policy: load the `jj` skill before running `jj` commands, then retry.
```

#### `inline_task_store_requires_tasks_skill`

Reject direct access to inline Trail task files under `.sandpiper/tasks/**` unless `tasks` skill is loaded.

Initial structured tool surfaces:

- `read` file/path argument
- `write` file/path argument
- `edit` file/path argument

Phase 0 must verify the exact active argument names before implementation hard-codes detector fields.

Initial bash inspection surface:

- simple `cat`, `ls`, `rg`, `grep`, or `sed` commands with a literal `.sandpiper/tasks/**` target

The bash detector must refuse ambiguous shell. Nested interpreters, variables, command substitution, aliases, functions, and scripts are out of MVP.

Task path detection must normalize relative and absolute inline paths. A relative `.sandpiper/tasks/...` target and an absolute `/path/to/project/.sandpiper/tasks/...` target should resolve to the same inline-storage match when the project root is known from the path.

This rule is an inline-storage detector, not the full Trail storage model. Trail supports separate branch/worktree and external repo storage modes. Future resolver-backed detection must ask Trail/storage configuration which paths are task storage for the target project.

Rejection text:

```text
Blocked by Sandpiper tool policy: load the `tasks` skill before accessing Trail task files directly. Use the Trail CLI for normal task work.
```

## Tool Call Handler

MVP handler shape:

```ts
pi.on("tool_call", async (event, ctx) => {
  const decision = evaluateToolPolicies(event, {
    loadedSkills,
  });

  if (decision.action === "reject") {
    return { block: true, reason: decision.reason };
  }

  if (decision.action === "observe") {
    recordPolicyObservation(decision);
  }
});
```

Handlers must avoid prompting the user. Rejection is deterministic and agent-facing.

## Persistence

Use two layers:

1. In-memory registry for fast current-session checks.
2. `pi.appendEntry()` session custom entries for reload/resume recovery.

Do not use the aggregate skill metrics database for live policy state. Metrics can remain diagnostic.

## Shell Relay

`shell_relay` is out of MVP.

Reasons:

- It runs in a shared, persistent user-visible Zellij pane.
- It can execute with the user's authenticated shell state.
- Persistent PATH or environment mutation can bleed into the user's later manual commands.
- Shell Relay is already a separate lifecycle/design problem and is tracked elsewhere.

If enforced later, it needs a separate adapter with per-command scoping and a clear user/agent ownership model.

## PATH Shim Layer

PATH shims are post-MVP.

They are still a strong candidate for command enforcement beyond direct shell strings because they catch subprocess-by-name invocations. A future shim layer should:

- Put a shim directory before real tool binaries only for agent-owned command execution.
- Resolve and exec the real binary without recursion.
- Query authoritative live skill state through a state file/socket or in-process bridge, not stale inherited environment.
- Preserve argv, stdin, stdout, stderr, TTY behavior, and exit code.
- Treat absolute paths and sanitized environments as accepted leakage.

The MVP does not need this machinery to catch the observed direct `jj` reflex.

## Project Context and Storage Modes

Policies must not assume the agent process CWD is the target project. Persistent agents often keep an identity workspace as process CWD and target project paths through tool arguments or command text.

MVP implications:

- `jj_requires_jj_skill` does not need project resolution to enforce skill loading: direct `jj` means `jj` skill is required.
- `inline_task_store_requires_tasks_skill` only covers normalized inline `.sandpiper/tasks/**` paths and high-confidence simple bash inspection of those paths.
- Future repo-aware `git` and full Trail storage policies need a target-context resolver keyed from the operation's path or command cwd.

Ambiguous context must degrade to observe/allow, never reject.

## Test Cases

Minimum tests:

1. `bash` command `jj status` before loading `jj` skill rejects.
2. Loading `jj` skill marks registry state.
3. `bash` command `jj status` after loading `jj` skill allows.
4. Non-`jj` bash command allows.
5. `read` path `.sandpiper/tasks/AGENT/AGENT-35.md` before loading `tasks` skill rejects.
6. `bash` command `cat .sandpiper/tasks/index.toon` before loading `tasks` skill rejects.
7. Loading `tasks` skill marks registry state.
8. Same `read` path and `cat` command after loading `tasks` skill allow.
9. `shell_relay` command is not rejected by MVP policies.
10. User `!jj status` is not rejected by agent tool policy.
11. `/skill:jj` expansion does not satisfy loaded-skill policy state unless explicitly implemented.

## Open Questions

- Exact custom entry type name for persisted loaded-skill records.
- Whether filesystem skill loads should ever satisfy catalog-skill policy aliases.
- Whether `/skill:name` slash-command expansion should mark loaded-skill state in a later iteration.
- Whether direct `git` should be in MVP or deferred until repo-context resolution exists.
- Whether policy observations should be stored in the session, diagnostics log, or both.
