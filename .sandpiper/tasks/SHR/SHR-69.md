---
title: "Implement zsh user command capture via zle widget override"
status: NOT STARTED
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-26T14:54:25.683Z
updated_at: 2026-03-29T00:37:46.889Z
---

# Implement zsh user command capture via zle widget override

`relay.zsh` currently defers user command capture to future work (noted in the file header comment). Fish has a full `fish_preexec`-based capture system; zsh needs an equivalent using its line editor (ZLE) hook system.

## Scope

- Implement a ZLE widget override in `relay.zsh` to intercept user-typed commands and wrap them in `__relay_run` (analogous to fish's `fish_preexec`)
- Handle zsh-specific edge cases:
  - Using `add-zsh-hook preexec` (the idiomatic zsh hook) vs. ZLE `accept-line` widget wrapping — evaluate which is cleaner
  - Pipelines and compound commands
  - Builtins vs. external binaries
  - History exclusion (`setopt HIST_IGNORE_SPACE` / space prefix)
  - Avoiding double-wrapping
  - Compatibility with other ZLE customizations (starship, powerlevel10k, etc.)
- Review `relay.ts` `buildInjectionCommand` for any zsh-specific adjustments needed as the pathway matures
- Add or extend tests to cover the zsh command capture pathway

## References

- `extensions/shell-relay/shell-integration/relay.zsh` — current implementation (deferred comment at top)
- `extensions/shell-relay/shell-integration/relay.fish` — fish_preexec implementation to reference for pattern
- `extensions/shell-relay/src/relay.ts` — `buildInjectionCommand`, `escapeForBash` (shared with zsh)

