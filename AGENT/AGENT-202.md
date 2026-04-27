---
title: "Extract generalized system notifications package"
status: NOT STARTED
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-05-18T14:46:42.639Z
updated_at: 2026-05-18T14:46:42.639Z
---

# Extract generalized system notifications package

Extract the existing Sandpiper system notification helper into a standalone reusable package for the Pi/Sandpiper ecosystem.

Rationale:
- Current helpers in packages/core/src/system-notification.ts are useful beyond Sandpiper itself.
- A standalone notification envelope package can be reused by other harnesses/adapters without depending on Tattler.
- Tattler can later add a bridge/protocol for externally sourced notifications, but should not own the notification abstraction.

Scope:
- Define a package such as @sandpiper-ai/system-notifications for envelope construction/parsing/validation and source metadata conventions.
- Keep the package transport-agnostic and independent of Tattler core.
- Preserve existing Sandpiper behavior and XML envelope compatibility.
- Decide whether Pi-specific sendMessage/deliverAs/triggerTurn helpers belong in this package or a thin adapter package.

Non-goals:
- Do not fold this into Tattler core.
- Do not build a new notification queue/dispatcher subsystem.
- Do not rewrite Pi session context handling.
