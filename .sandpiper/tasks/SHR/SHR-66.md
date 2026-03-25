---
title: "Register shell relay preflight check for integration installation"
status: NOT STARTED
kind: TASK
priority: HIGH
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-25T21:55:31.145Z
updated_at: 2026-03-25T22:05:02.964Z
depends_on:
  - SHR-65
---

# Register shell relay preflight check for integration installation

Register a preflight check in the shell relay extension that verifies the integration is sourced and working.

## Check Logic

Detect shell from process.env.SHELL, then verify the __relay_prompt_hook function is defined:

  Fish:  fish -c 'functions -q __relay_prompt_hook'
  Bash:  bash -i -c 'type __relay_prompt_hook > /dev/null 2>&1'
  Zsh:   zsh -i -c 'whence __relay_prompt_hook > /dev/null 2>&1'

Use execSync() with stdio: 'ignore'. Exits 0 = sourced (healthy). Throws = not sourced (unhealthy).

If SHELL is unrecognized or the check itself fails to spawn, fall back to file existence
at ~/.sandpiper/shell-integrations/relay.<ext>.

## Diagnostic when unhealthy

message: 'Shell integration not sourced'
instructions (fish example):
  - 'Add to ~/.config/fish/config.fish:'
  - '    source ~/.sandpiper/shell-integrations/relay.fish'
  - 'Or run: sandpiper --install-shell-integrations for installation instructions'

## Registration

Called in shell relay extension factory body:
  registerPreflightCheck('shell-relay:integration', () => { ... })

## Notes

- execSync is synchronous — compatible with factory-body registration
- Fish sources config.fish for all sessions including -c invocations (no -i needed)
- Bash/zsh need -i to source RC files

---

# Activity Log

## 2026-03-25T21:56:06.097Z

- **description**: added (29 lines)

## 2026-03-25T22:05:02.965Z

- **description**: 29 lines → updated (33 lines)
