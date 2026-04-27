---
title: "Make system prompt diagnostics credential-free"
status: COMPLETE
resolution: DONE
kind: BUG
priority: HIGH
assignee: "Piper"
reporter: USER
created_at: 2026-08-11T21:44:21.078Z
updated_at: 2026-08-12T21:40:06.834Z
related:
  - AGENT-262
  - AGENT-271
---

# Make system prompt diagnostics credential-free

sandpiper-system-prompt makes no model request but still initializes provider credential validation, repeatedly triggering 1Password/TouchID during editor launches and verification. Reproduce the credential lookup path and provide a diagnostic startup path that constructs the real prompt without loading or validating model-provider credentials.

---

# Activity Log

## 2026-08-11T21:44:21.170Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → Piper

## 2026-08-12T21:28:41.516Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-08-12T21:40:06.835Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
