---
title: "Add --install-shell-integrations flag to system extension"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-03-25T21:55:27.848Z
updated_at: 2026-03-26T04:27:06.301Z
depends_on:
  - AGENT-12
---

# Add --install-shell-integrations flag to system extension

Add --install-shell-integrations flag to system extension.

## Behavior

- Handled in session_directory (same pattern as --migrate-pi-configs)
- Copies all shell integration scripts to ~/.sandpiper/shell-integrations/
- Prints sourcing instructions for each shell to stdout
- Exits 0 on success, 1 on failure

## Scripts to install

From extensions/shell-relay/shell-integration/:
  relay.fish  → ~/.sandpiper/shell-integrations/relay.fish
  relay.bash  → ~/.sandpiper/shell-integrations/relay.bash
  relay.zsh   → ~/.sandpiper/shell-integrations/relay.zsh

## Stdout output (success)

Shell integration scripts installed to ~/.sandpiper/shell-integrations/

Add the appropriate line to your shell config:

  Fish (~/.config/fish/config.fish):
    source ~/.sandpiper/shell-integrations/relay.fish

  Bash (~/.bashrc):
    source ~/.sandpiper/shell-integrations/relay.bash

  Zsh (~/.zshrc):
    source ~/.sandpiper/shell-integrations/relay.zsh

## Install logic

- Create ~/.sandpiper/shell-integrations/ if not exists
- Copy (overwrite) each script — users should not edit these files
- Source path for the copy: locate scripts relative to extension root (same pattern as ghost-attach/unbuffer-relay)

---

# Activity Log

## 2026-03-25T21:55:57.925Z

- **description**: added (36 lines)

## 2026-03-25T22:06:59.455Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-25T22:08:14.647Z

- **status**: IN PROGRESS → NEEDS REVIEW
- **resolution**: DONE

## 2026-03-26T04:27:06.302Z

- **status**: NEEDS REVIEW → COMPLETE
