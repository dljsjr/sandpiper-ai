---
title: "Core preflight check system"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-03-25T21:55:27.775Z
updated_at: 2026-03-26T04:27:06.182Z
---

# Core preflight check system

Implement the preflight check registration system in packages/core.

## Interface

```typescript
export interface PreflightDiagnostic {
  readonly key: string;
  readonly healthy: boolean;
  readonly message: string;        // Short one-liner: "Shell integration not installed"
  readonly instructions?: string[]; // Actionable steps shown in the banner
}

type PreflightCheck = () => PreflightDiagnostic;
```

## Free Function

```typescript
export function registerPreflightCheck(
  key: string,
  pi: ExtensionAPI,
  check: PreflightCheck,
): void
```

## Implementation Notes

- Module-level registry in packages/core (array of registered checks)
- Called during extension factory body (synchronous)
- Callbacks MUST be synchronous — factory body cannot await
- pi.appendEntry() timing is uncertain during factory execution; use module-level array instead
- System extension reads registry at session_start and runs all checks
- pi: ExtensionAPI is accepted but may not be used in initial impl; reserved for future use (e.g. if we find appendEntry works)

## No pi imports in core

The PreflightDiagnostic interface and registry must not import from pi.

---

# Activity Log

## 2026-03-25T21:55:40.443Z

- **description**: added (37 lines)

## 2026-03-25T21:56:16.026Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-25T21:56:45.854Z

- **status**: IN PROGRESS → NEEDS REVIEW
- **resolution**: DONE

## 2026-03-26T04:27:06.183Z

- **status**: NEEDS REVIEW → COMPLETE
