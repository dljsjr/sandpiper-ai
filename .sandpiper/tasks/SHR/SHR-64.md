---
title: "Install shell integration scripts to a well-known location"
status: NEEDS REVIEW
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-25T16:20:48.361Z
updated_at: 2026-03-25T22:09:25.506Z
---

# Install shell integration scripts to a well-known location

Install shell integration scripts to a well-known location so users can source from a stable path instead of the npm/bun package install location.

## Implementation Plan

Decomposed into four tasks:
- AGENT-12: Core preflight check system (registerPreflightCheck, PreflightDiagnostic)
- AGENT-13: System extension: aggregate and display preflight diagnostics banner
- SHR-65: --install-shell-integrations flag (copies scripts, prints instructions, exits)
- SHR-66: Shell relay preflight check (verifies scripts exist at well-known location)

## Well-Known Location

~/.sandpiper/shell-integrations/
  relay.fish
  relay.bash
  relay.zsh

---

# Activity Log

## 2026-03-25T16:21:01.517Z

- **description**: added (7 lines)

## 2026-03-25T21:56:12.559Z

- **description**: 7 lines → updated (16 lines)

## 2026-03-25T22:09:25.507Z

- **status**: NOT STARTED → NEEDS REVIEW
- **resolution**: DONE
