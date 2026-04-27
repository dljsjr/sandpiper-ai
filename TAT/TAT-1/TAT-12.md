---
title: "Add automated Tattler v0 protocol and identity tests"
status: NOT STARTED
kind: SUBTASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-05-20T06:25:56.136Z
updated_at: 2026-05-20T06:25:56.136Z
---

# Add automated Tattler v0 protocol and identity tests

Dogfood exposed several regressions that focused tests would catch: missing serialized format fields after type-level branding, stale identity files listing dead sockets, and startup paths that can leave a socket alive without identity/tool registration. Add focused tests around protocol frame serialization/parsing, send ACK/ERR settlement, identity-file discovery liveness, and startup failure handling without touching real user runtime state.
