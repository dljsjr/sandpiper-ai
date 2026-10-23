# AGENT-35 Deterministic Tool-Use Enforcement — Work Plan

- **Diátaxis mode**: How-to implementation plan
- **Status**: Draft
- **Ticket**: AGENT-35
- **Date**: 2026-06-10

---

## Scope

Build the smallest useful deterministic enforcement slice:

- Track catalog skills loaded through the `skill` tool.
- Use Pi `tool_call` to reject high-confidence operations when the required skill is missing.
- Enforce one MVP policy: a direct `jj` command through standard `bash` requires the `jj` skill.

Task-tracker policies are outside this draft until an external provider contract exists.

Do not implement guidance injection, playbook-read tracking, `/skill:name` activation tracking, `shell_relay` enforcement, PATH shims, or a policy DSL in the MVP.

## Phase 0 — Spike the Hook Surface

Goal: prove the Pi/Sandpiper build behaves as the Pi docs describe.

1. Create a temporary local extension or test fixture that registers a `tool_call` handler.
2. Verify `tool_call` fires before standard `bash` execution.
3. Verify returning `{ block: true, reason }` blocks the bash command and surfaces the reason to the agent.
4. Verify `tool_call` fires for `read`, `write`, and `edit`; record the exact active file/path argument names from their schemas.
5. Verify `tool_call` fires for standard `bash` command strings.
6. Verify `user_bash` is distinct from agent `tool_call` and is not affected.
7. Verify `shell_relay` can be excluded by tool name.

Exit criteria:

- A direct `bash` command can be blocked before execution.
- A direct `read`/`edit`/`write` path can be blocked before execution.
- No implementation work begins if this spike fails.

## Phase 1 — Loaded Skill Registry

Goal: make loaded catalog skill state available to policy evaluation.

1. Locate the successful skill-load choke point in `extensions/system/skill-loading-tool.ts`.
2. Add a live loaded-skill registry in the system extension layer.
3. Update the registry only after successful skill load.
4. Persist loaded-skill records with `pi.appendEntry()` after wiring the needed extension/context access; do not assume current skill-loading glue can already call it.
5. Restore loaded-skill state on `session_start` by scanning prior custom entries.
6. Treat `/skill:name` slash-command expansion as out of scope / not policy-satisfying unless that path is explicitly hooked later.
7. Keep existing aggregate skill metrics untouched.

Verification:

- Loading `jj` through the `skill` tool marks `jj` loaded.
- Loading `code-review` through the `skill` tool marks `code-review` loaded.
- Failed skill loads do not mark skills loaded.
- Reload/resume preserves loaded-skill records within the session.
- `available_skills` catalogue metadata alone does not mark any skill loaded.
- `/skill:jj` expansion does not mark `jj` loaded in MVP.

## Phase 2 — Policy Evaluator Skeleton

Goal: create a small typed policy evaluator without building a rules DSL.

1. Add `ToolPolicyDecision` (`allow | reject | observe`).
2. Add a `ToolPolicy` interface with an `evaluate()` function.
3. Add `evaluateToolPolicies()` that returns the first rejecting decision, records observations, and otherwise allows.
4. Wire the evaluator into `pi.on('tool_call')`.
5. Add diagnostic logging for policy observations and rejections.

Verification:

- Policies can be unit-tested without Pi runtime.
- `tool_call` handler blocks only on `reject` decisions.
- `observe` decisions never block.

## Phase 3 — MVP Policies

### Policy 1: `jj_requires_jj_skill`

1. Add a conservative detector for direct `jj` commands in standard `bash`.
2. Reject when the detector matches and `jj` skill is not loaded.
3. Allow when `jj` skill is loaded.
4. Refuse to match ambiguous shell commands.

Initial detector scope:

- Match `jj` as the leading command token with any arguments; `jj status`, `jj log`, and `jj diff` are examples, not an allowlist
- Match leading whitespace before `jj`
- Optional after tests: literal `cd <path> && jj ...`
- Do not match: variables, command substitution, nested interpreters, scripts, aliases, or pipelines

Verification:

- `bash: jj status` rejects before `jj` skill load.
- `bash: jj status` allows after `jj` skill load.
- `bash: echo jj status` allows.
- Ambiguous commands observe or allow; they never reject.

## Phase 4 — Tests

Add focused tests before broad integration.

Suggested test layers:

1. Registry unit tests
   - mark loaded
   - reject failed loads
   - restore from custom session entries
2. Command detector unit tests
   - direct `jj`
   - whitespace
   - non-matches
   - ambiguous commands
3. Policy evaluator unit tests
   - missing skill rejects
   - loaded skill allows
   - observe never blocks
4. Extension integration test
   - `tool_call` handler returns block for a synthetic bash event
   - structured path event blocks correctly

Run the focused test command from `.sandpiper/playbooks/development/typescript-and-tests.md`.

## Phase 5 — Documentation and Routing

1. Keep the PRD, spec, and work plan in `.sandpiper/docs/specs/`.
2. Update `.sandpiper/docs/README.md` with all three docs.
3. Update project playbooks only if implementation creates new operational guidance.
4. Do not add agent-facing policy wording as a substitute for enforcement.

## Phase 6 — Completion Criteria

AGENT-35 MVP is done when:

- `jj` direct command enforcement works through standard `bash`.
- loaded-skill state is live, session-persistent, and not confused with catalogue discovery.
- `shell_relay` is explicitly out of MVP and unaffected.
- Tests cover registry, detector, evaluator, and hook integration.
- Docs and task references point to the final design.

## Post-MVP Candidates

Do these only after MVP proves the core behavior:

| Candidate                                       | Why deferred                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| PATH shim / wrapper for `jj`                    | Catches subprocess-by-name but needs passthrough fidelity and state transport   |
| `/skill:name` activation tracking               | Needs input-pipeline integration if slash skill expansion should satisfy policy |
| `shell_relay` adapter                           | Shared user pane requires separate lifecycle and ownership design               |
| Repo-aware `git` policy                         | Needs target-project and jj/git repo resolution                                 |
| `gh`, `glab`, `bun`, `uv` precondition policies | Same shape, but wait until the initial MVP proves useful                           |
| Waymark-backed playbook/role preconditions      | Different substrate; not catalog skill state                                    |

## Handoff Notes

Design pressure to preserve:

- This is skill-precondition enforcement, not guidance retrieval.
- Reject only high-confidence matches.
- False positives are worse than false negatives.
- Persistent agents do not have project CWDs; future context-sensitive policies must resolve target context from the operation.
- Shell Relay is intentionally out of MVP.
