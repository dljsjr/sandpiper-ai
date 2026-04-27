---
title: "Implement stable Tattler agent identity and directory"
status: NOT STARTED
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-05-15T03:13:38.326Z
depends_on:
  - TAT-6
updated_at: 2026-05-15T03:13:47.561Z
---

# Implement stable Tattler agent identity and directory

Implement the first-MVP identity layer after v0 validation.

Scope:
- Persist UUIDv4 agentId in session state via appendEntry type sandpiper:agent-identity.
- Support --agent-name <handle> startup registration.
- Support /rename-agent <handle>.
- Store registered global handles in $XDG_STATE_HOME/sandpiper/agents.sqlite3.
- Enforce handle syntax and point-in-time uniqueness.
- Display guests as guest:<short-uuid>.

Depends on: TAT-6 / v1 mini-spec.

---

# Activity Log

## 2026-05-15T03:13:47.561Z

- **depends_on**: (none) → TAT-6
