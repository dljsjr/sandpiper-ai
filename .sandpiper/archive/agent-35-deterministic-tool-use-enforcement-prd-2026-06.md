# AGENT-35 Deterministic Tool-Use Enforcement — PRD

- **Diátaxis mode**: Reference / product requirements
- **Status**: Draft
- **Ticket**: AGENT-35
- **Date**: 2026-06-10
- **Primary implementation area**: Sandpiper system extension / skill-loading tool

---

## Problem

Agents sometimes perform skill-shaped work without loading the skill that defines the workflow. The failure is not lack of written guidance: the rule can exist at the right layer and still lose to muscle memory.

Observed failures:

- Running `jj` directly before loading the `jj` skill
- Editing agent-facing playbooks before loading the relevant librarian guidance

The last example is deliberately not part of this MVP. Catalog skill loading is observable when it goes through the Sandpiper `skill` tool. Arbitrary playbook or role reading is not observable in the same way and belongs with Waymark/RG-style routing, not AGENT-35.

For MVP, "loaded" means successfully loaded through the Sandpiper `skill` tool. `/skill:name` slash-command expansion is out of scope unless implementation proves and wires that path explicitly.

AGENT-35 should make the wrong high-confidence operation stop before it runs, with a terse remediation: load the required skill, then retry.

## Goals

1. Reject selected tool operations when their required catalog skill has not been loaded in the current session.
2. Keep enforcement deterministic, narrow, and explainable.
3. Use Pi's `tool_call` event as the MVP interception surface.
4. Track live loaded-skill state from the `skill` tool's successful load path.
5. Fail safe: ambiguous detection observes or allows; it does not reject.

## Non-goals

- Do not inject playbooks, leaf docs, or contextual guidance based on tool use. Reinforced Guidance owns retrieval/injection.
- Do not track arbitrary playbook or role reads. Waymark is the right substrate for that problem.
- Do not enforce `shell_relay` in the MVP. Shared terminal lifecycle and user/agent ownership need separate design.
- Do not build a general DSL before multiple real policies require it.
- Do not attempt to make shell-command enforcement airtight. This is a behavior guardrail, not a security sandbox.

## MVP Scope

The MVP covers private agent tool calls that flow through Pi `tool_call`:

| Operation                                                                                                                                          | Required skill | Detection                            | MVP action                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------ | -------------------------- |
| Standard `bash` command is a high-confidence direct `jj` invocation                                                                                | `jj`           | Conservative command-string detector | Reject if skill not loaded |

Task-tracker policies are outside this draft until an external provider contract exists.

## Success Criteria

- Running a high-confidence direct `jj` command through the standard `bash` tool before loading the `jj` skill is blocked with actionable remediation.
- Loading the `jj` skill through the `skill` tool updates live session policy state.
- Retrying the same `jj` command after loading the `jj` skill is allowed.
- Normal tool calls outside the MVP policies are unaffected.
- `shell_relay` is unaffected by MVP enforcement.
- User `!` / `!!` shell commands are unaffected; they use Pi's separate `user_bash` event, not agent `tool_call`.

## User Experience

A rejection should be short and mechanical:

```text
Blocked by Sandpiper tool policy: load the `jj` skill before running `jj` commands, then retry.
```

The agent should not receive a lecture. The recovery loop is the product: load the skill, retry the operation.

## Risks

| Risk                                               | Mitigation                                                                                                                         |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| False positives make the system intolerable        | Only high-confidence detectors may reject. Ambiguous operations observe or pass.                                                   |
| Persistent-agent process CWD is not a project CWD  | MVP `jj` skill gating does not require repo resolution. Future repo-aware policies must resolve target context from the operation. |
| Skill discovery is confused with skill loading     | Use live state recorded from successful `skill` tool execution; do not use `available_skills` catalogue metadata.                  |
| `/skill:name` expansion is confused with tool load | MVP only treats successful Sandpiper `skill` tool calls as loaded state unless slash-skill expansion is explicitly wired later.    |
| Scope creeps into RG or Waymark                    | Keep AGENT-35 limited to observable catalog skill preconditions.                                                                   |

## Deferred Work

- PATH shim / wrapper layer for subprocess-mediated command invocations such as `python -c 'subprocess.run(["jj"])'`
- `shell_relay` adapter after Shell Relay lifecycle/ownership is redesigned
- Repo-aware `git` policy that checks whether a target directory is a jj repo
- `/skill:name` slash-command activation tracking, if Sandpiper decides it should satisfy tool-policy preconditions
- Waymark-backed playbook/role-read preconditions
