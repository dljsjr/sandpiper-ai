---
title: "Implement bash user command capture via DEBUG trap"
status: NOT STARTED
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-26T14:54:22.600Z
updated_at: 2026-03-29T00:37:46.890Z
---

# Implement bash user command capture via DEBUG trap

`relay.bash` currently defers user command capture to future work (noted in the file header comment). Fish has a full `fish_preexec`-based capture system that intercepts user-typed commands and wraps them in `__relay_run`; bash needs an equivalent.

## Scope

- Implement the `DEBUG` trap in `relay.bash` to intercept user-typed commands before execution and wrap them in `__relay_run`
- Handle bash-specific edge cases:
  - Distinguishing interactive user commands from programmatic DEBUG trap firings (use `$BASH_COMMAND`, check `$-` for interactivity)
  - Pipelines and compound commands
  - Builtins vs. external binaries (builtins don't produce colored output so PTY allocation may not be needed)
  - History exclusion (`HISTCONTROL=ignorespace` / space prefix)
  - Avoiding double-wrapping if `__relay_run` itself triggers DEBUG
- Review `relay.ts` `buildInjectionCommand` for any bash-specific adjustments needed as the pathway matures
- Add or extend tests to cover the bash command capture pathway

## References

- `extensions/shell-relay/shell-integration/relay.bash` — current implementation (deferred comment at top)
- `extensions/shell-relay/shell-integration/relay.fish` — fish_preexec implementation to reference for pattern
- `extensions/shell-relay/src/relay.ts` — `buildInjectionCommand`, `escapeForBash`

