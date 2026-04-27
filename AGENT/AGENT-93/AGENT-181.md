---
title: "Certify root-router distribution layout"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-05-06T20:10:54.358Z
updated_at: 2026-05-07T18:44:23.146Z
---

# Certify root-router distribution layout

Final certification pass for the root-router distribution layout after AGENT-176 through AGENT-180.

Scope:
- Assert the root package is a workspace router/runtime anchor, not the owner of implementation resources.
- Verify root pi metadata points only to provider/package-owned paths: plugins/pi/extensions, packages/resources/skills, packages/resources/prompts, packages/resources/themes.
- Verify Sandpiper-specific runtime metadata remains in piConfig/bin and does not leak into the neutral Pi package.
- Verify clean distribution assembly from an empty dist directory.

Acceptance criteria:
- Root-router invariants are covered by tests.
- Clean distribution gate passes with: rm -rf dist && env -u PI_PACKAGE_DIR bun run test:distribution.
- bun check passes with zero errors and zero warnings.
- AGENT-93 is ready for stack review.

---

# Activity Log

## 2026-05-07T04:30:40.282Z

- **description**: added (13 lines)

## 2026-05-07T15:13:19.776Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-05-07T15:16:22.676Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-07T18:44:23.147Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
