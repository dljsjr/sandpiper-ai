# Task Management Specification

This document defines the specification for the markdown-based task management system used by the `tasks` skill. It uses IETF RFC 2119 requirement level key words (MUST, SHOULD, MAY, etc.) to communicate the importance of rules.

## 1. Overview

Tasks are work items stored as markdown files with YAML frontmatter in a project-local `.sandpiper/tasks` directory. The system supports three kinds of work items (tasks, bugs, subtasks), organizes them into projects identified by short keys, and tracks relationships between them.

## 2. Projects

### 2.1 Project Key

A project key MUST be composed of exactly 3 uppercase ASCII letters, matching the pattern `[A-Z]{3}`.

Examples: `SHR`, `CLI`, `COR`

### 2.2 Project Directory

A project that has tasks MUST have its own directory under `.sandpiper/tasks/` using the project key as the directory name.

```
.sandpiper/tasks/<PROJECT_KEY>/
```

### 2.3 Project Counter State

Task numbering counters are maintained in the task index file (`index.toon`), not in per-project metadata files. Each project's `nextTaskNumber` is stored in the index's `counters` section.

If the index is unavailable (e.g., first use, corrupted, or deleted), the counter MUST be rebuilt by scanning existing task files and using the highest task number found + 1.

Legacy `.meta.yml` files MAY be present from older versions and are supported as a fallback counter source, but MUST NOT be created by new implementations.

## 3. Task Keys

### 3.1 Format

A task key MUST use the format `<PROJECT_KEY>-<TASK_NUMBER>`.

- The project key component MUST match the owning project's key.
- The task number component MUST be a positive integer.

Examples: `SHR-1`, `SHR-42`, `CLI-7`

### 3.2 Task Numbering

- Task numbers MUST be monotonically increasing integers that increment by one for each new task.
- Task numbers MUST start at `1` for the first task in a project.
- Task numbers MUST be scoped to the project key. Each project maintains its own independent counter.
- The counter MUST be shared across all task kinds (`TASK`, `BUG`, `SUBTASK`) within a project. Creating a `SUBTASK` consumes the next number from the same counter as `TASK` and `BUG`.
- The current counter value is stored in the task index (see §2.3).

### 3.3 Counter Operations

When creating a new task:

1. Read `nextTaskNumber` from the index's counters (primary), legacy `.meta.yml` (fallback), or scan task files for the highest number (last resort).
2. Use that value as the new task's number.
3. Create the task file.
4. Update the index (which recalculates counters from all task files).

These operations SHOULD be treated as atomic — do not create the task file without updating the index.

## 4. Task Files

### 4.1 File Naming

A task file MUST use its task key as its file name with a `.md` suffix.

Example: `SHR-1.md`, `SHR-42.md`

### 4.2 File Location

- Tasks of kind `TASK` or `BUG` MUST be located at the root of their owning project's directory.
- Tasks of kind `SUBTASK` MUST be located inside a subdirectory named after their parent task's key.

```
.sandpiper/tasks/<PROJECT_KEY>/<TASK_KEY>.md          # TASK or BUG
.sandpiper/tasks/<PROJECT_KEY>/<PARENT_KEY>/<TASK_KEY>.md  # SUBTASK
```

### 4.3 Subtask Directories

If a task of kind `TASK` or `BUG` has subtasks, there MUST be a directory using the parent task's key as its name (without the `.md` extension), located alongside the parent task file.

Example:
```
.sandpiper/tasks/SHR/
├── SHR-1.md              # TASK
├── SHR-1/                # Subtask directory for SHR-1
│   ├── SHR-2.md          # SUBTASK of SHR-1
│   └── SHR-3.md          # SUBTASK of SHR-1
├── SHR-4.md              # BUG (top-level, may be related to SHR-1)
└── SHR-5.md              # TASK
```

### 4.4 File Structure

A task file has three sections, in order:

1. **Frontmatter** — YAML metadata between `---` delimiters
2. **Body** — Markdown content starting with a level-1 heading matching the `title` field, followed by the task description
3. **Activity Log** (optional) — Change history, separated from the body by a `---` delimiter

```markdown
---
title: "My Task"
status: IN PROGRESS
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-03-20T15:00:00Z
updated_at: 2026-03-21T10:00:00Z
---

# My Task

Description of the task goes here.

---

# Activity Log

## 2026-03-21T09:00:00.000Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-21T10:00:00.000Z

- **priority**: MEDIUM → HIGH
```

The frontmatter MUST open with `---` on the first line and close with `---`. The body MUST start with a level-1 heading (`# ...`) that matches the `title` frontmatter field. The activity log, if present, MUST be separated from the body by a `---` delimiter followed by a `# Activity Log` heading.

### 4.5 Tombstone Files

When a task is moved to a different project (re-keyed), a tombstone file MUST be created at the original location. The tombstone file uses the original task key with a `.moved` extension and contains the new task key.

```
.sandpiper/tasks/SHR/SHR-5.moved    # Contains: "CLI-8\n"
```

Tombstone files serve two purposes:
- **Counter preservation**: The index scanner counts `.moved` files when rebuilding counters, preventing re-use of the original task number.
- **Redirect documentation**: Provides a human-readable record of where the task was moved to.

## 5. Frontmatter

### 5.1 Required Fields

Every task file MUST include the following frontmatter fields:

| Field | Type | Allowed Values | Description |
|-------|------|----------------|-------------|
| `title` | string | Free text | Short summary of the task. MUST also appear as the level-1 heading in the markdown body. |
| `status` | enum | `NOT STARTED`, `IN PROGRESS`, `NEEDS REVIEW`, `COMPLETE` | Current status of the task. |
| `kind` | enum | `BUG`, `TASK`, `SUBTASK` | The type of work item. |
| `priority` | enum | `LOW`, `MEDIUM`, `HIGH` | Relative priority of the task. |
| `assignee` | string | `UNASSIGNED`, `USER`, `AGENT` | Who is currently working on the task. |
| `reporter` | string | `USER`, `AGENT` | Who surfaced the work item and created the task. |
| `created_at` | string (ISO 8601) | e.g., `2026-03-20T15:00:00Z` | Timestamp when the task was created. MUST be set once at creation and MUST NOT be modified. |
| `updated_at` | string (ISO 8601) | e.g., `2026-03-20T16:30:00Z` | Timestamp of the most recent modification. MUST be updated whenever any field or the body is changed. |

### 5.1.1 Conditionally Required Fields

| Field | Type | Allowed Values | Condition | Description |
|-------|------|----------------|-----------|-------------|
| `resolution` | enum | `DONE`, `WONTFIX` | Required when `status` is `COMPLETE` | The resolution of the completed task. `DONE` indicates the work was completed successfully. `WONTFIX` indicates the task is no longer valid or will not be addressed. |

### 5.2 Optional Fields

A task file MAY include the following additional frontmatter fields:

| Field | Type | Description |
|-------|------|-------------|
| `related` | array of task keys | Tasks that relate to this task but do not form a dependency. |
| `depends_on` | array of task keys | Tasks that MUST be completed before this task can be completed. Used for planned dependencies. |
| `blocked_by` | array of task keys | Tasks that are blocking this task from being completed. Used for unplanned dependencies such as interrupt work or bugs discovered during implementation. |

### 5.3 Field Semantics

#### `status`

- `NOT STARTED` — The task has been defined but no work has begun.
- `IN PROGRESS` — The task is actively being worked on.
- `NEEDS REVIEW` — The work is complete but awaits confirmation or review.
- `COMPLETE` — The task is done and confirmed.

#### `assignee`

- `UNASSIGNED` — No one is currently working on this task.
- `USER` — The user is working on this task.
- `AGENT` — The agent is working on this task.

#### `reporter`

- `USER` — The user surfaced this work item. If the user asks the agent to create a task, the reporter is `USER`.
- `AGENT` — The agent identified this work item independently (e.g., discovered a bug during implementation, identified missing requirements).

#### `depends_on` vs `blocked_by`

Both express dependencies, but their intent differs:

- `depends_on` is for **planned** dependencies — work that was known at planning time to be a prerequisite.
- `blocked_by` is for **unplanned** dependencies — obstacles discovered during implementation, such as bugs that must be fixed first or interrupt work that takes priority.

A task MAY have both `depends_on` and `blocked_by` entries simultaneously.

#### `resolution`

Required when `status` is `COMPLETE`. MUST NOT be present when `status` is any other value.

- `DONE` — The work was completed successfully.
- `WONTFIX` — The task is no longer valid, relevant, or will not be addressed. Used instead of deleting a task (see §7.5).

## 6. Task Hierarchy

### 6.1 Top-Level Tasks

Tasks of kind `TASK` and `BUG` MUST always be top-level — they MUST be located directly under their project directory, never nested inside another task's subtask directory.

### 6.2 Subtasks

- A `SUBTASK` MUST be the child of exactly one `TASK` or `BUG`.
- The parent-child relationship is expressed by the filesystem layout: the subtask file resides inside the parent task's subtask directory (see §4.3).
- A `SUBTASK` MUST NOT have its own subtasks. The maximum nesting depth is one level.

### 6.3 Bugs

A bug discovered while working on a task MUST be created as a separate top-level `BUG`, NOT as a `SUBTASK` of the task. The relationship between the bug and the originating task SHOULD be expressed using either the `related` or `blocked_by` frontmatter fields, depending on whether the bug blocks the task's completion.

## 7. Task Lifecycle

### 7.1 Creation

When creating a task, the agent or user MUST:

1. Determine the next task number (from the index, or by scanning existing task files for the highest number).
2. Create the task file with all required frontmatter fields.
3. Set `created_at` and `updated_at` to the current timestamp.
4. Set `status` to `NOT STARTED`.
5. Update the index to reflect the new task.

If the project directory does not exist, it MUST be created.

### 7.2 Status Transitions

There are no enforced state machine constraints on status transitions. Any status MAY transition to any other status. However, the following flow is RECOMMENDED:

```
NOT STARTED → IN PROGRESS → NEEDS REVIEW → COMPLETE
```

The `assignee` field SHOULD be updated in conjunction with status changes:
- When picking up a task: set `assignee` to `AGENT` or `USER`, set `status` to `IN PROGRESS`.
- When finishing work: set `status` to `NEEDS REVIEW`.
- When the user confirms completion: set `status` to `COMPLETE`.

### 7.3 Completion

When setting `status` to `COMPLETE`, a `resolution` field MUST be provided:
- `DONE` — for work that was completed successfully
- `WONTFIX` — for tasks that are no longer valid or will not be addressed

Completed tasks MUST remain in place. They MUST NOT be automatically deleted or moved. Archiving completed tasks is an explicit, periodic operation performed by the user.

### 7.4 Modification

When any field or the markdown body of a task is modified, the `updated_at` field MUST be set to the current timestamp. The `created_at` field MUST NOT be modified after initial creation.

### 7.5 CLI-First Operations

Task operations SHOULD be performed through the `sandpiper-tasks` CLI whenever possible. The CLI maintains the task index, enforces validation rules (e.g., resolution required for COMPLETE), and ensures consistent formatting.

Direct file editing MAY be used in exceptional circumstances (e.g., bulk body text edits, recovery from corruption, or when the CLI is unavailable), but is NOT RECOMMENDED for routine operations. The indexing system is designed to detect and incorporate out-of-band file modifications, but direct edits bypass validation and may produce inconsistent state.

### 7.6 No Deletion

Tasks MUST NOT be deleted. A task that is no longer valid MUST be marked as `COMPLETE` with resolution `WONTFIX`. This preserves the historical record and audit trail of all work items, including those that were abandoned or superseded.

The only exception is cleanup of test data or accidental duplicates, which SHOULD be performed by the user, not the agent.

### 7.7 Activity Log

Every modification to a task (excluding creation) MUST append an entry to the task's activity log. The activity log is a structured footer within the task file (see §4.4).

#### 7.7.1 Entry Format

Each entry MUST include:
- A level-2 heading (`##`) with an ISO 8601 timestamp
- A bullet list of field changes

Field changes MUST be formatted as:
- **Simple field change**: `- **field**: old value → new value`
- **Field added** (no previous value): `- **field**: new value`
- **Description change**: `- **description**: added (N lines)`, `- **description**: N lines → M lines`, or `- **description**: cleared`

#### 7.7.2 When Entries Are Created

An activity log entry MUST be created for any operation that modifies the task file, including:
- Status changes (update, pickup, complete)
- Field updates (assignee, priority, title, reporter, resolution)
- Description changes
- Relationship changes (depends_on, blocked_by, related)

An activity log entry MUST NOT be created on task creation — the `created_at` timestamp serves that purpose.

#### 7.7.3 Description Change Summaries

Description changes in the activity log SHOULD show a compact line-count summary rather than the full content diff:
- `added (3 lines)` — description was empty, now has content
- `1 line → 5 lines` — description grew
- `cleared` — description was removed
- `updated` — description changed but line count is the same

Full content diffs are stored separately in the history directory (see §8).

### 7.8 Move Operations

A task MAY be moved between projects, converted between kinds, or reparented. Move operations are performed via the `task move` command.

#### 7.8.1 Kind Changes

- `TASK` ↔ `BUG`: A field-only change. The file stays in the same location. The task key is preserved.
- `TASK`/`BUG` → `SUBTASK`: The task file is moved into the specified parent's subtask directory. Requires a `--parent` flag. If the task being demoted has subtasks of its own, those subtasks MUST be reparented to the new parent.
- `SUBTASK` → `TASK`/`BUG`: The subtask file is promoted to the project root directory. The task key is preserved (same project).

#### 7.8.2 Cross-Project Moves

When a task is moved to a different project:
- The task MUST be assigned a new key from the target project's counter.
- All subtasks of the moved task MUST also be moved and re-keyed.
- A `.moved` tombstone file MUST be created for each re-keyed task at its original location (see §4.5).
- All references to re-keyed tasks in other task files' `depends_on`, `blocked_by`, and `related` fields MUST be updated to the new keys.

#### 7.8.3 Subtask Cross-Project Rules

- A subtask MUST belong to the same project as its parent task.
- A subtask MUST NOT be moved to a different project unless it is simultaneously promoted to `TASK` or `BUG`.
- When a parent task is moved to a different project, all of its subtasks MUST follow.

#### 7.8.4 Move Validation

The following moves MUST be rejected:
- Converting to `SUBTASK` without specifying a parent
- Making a task a subtask of another `SUBTASK` (subtasks cannot have subtasks)
- Moving a subtask to a different project without promoting it to `TASK` or `BUG`

## 8. History

### 8.1 Overview

The system maintains a history of full-content diffs for every task modification. History diffs complement the in-file activity log (§7.7) by preserving the actual content changes, including description edits, for auditing purposes.

### 8.2 Directory Structure

History diffs are stored in a flat directory structure under the tasks root:

```
.sandpiper/tasks/history/<TASK_KEY>/<TIMESTAMP>.diff
```

- The `history/` directory is at the tasks root, NOT nested under project directories.
- Each task with history has its own subdirectory named by task key.
- Diff files are named with the ISO 8601 timestamp of the change (colons replaced with hyphens for filesystem compatibility).
- If multiple changes occur within the same timestamp, a numeric suffix is appended (e.g., `2026-03-22T03-25-51.000Z-1.diff`).

### 8.3 Diff Format

Each `.diff` file contains a standard unified diff:

```diff
--- a/SHR-1.md
+++ b/SHR-1.md
@@ -4,7 +4,7 @@
 kind: TASK
 priority: HIGH
-status: NOT STARTED
+status: IN PROGRESS
-assignee: UNASSIGNED
+assignee: AGENT
```

The diff covers the entire file content, including frontmatter, description, and activity log changes.

### 8.4 When Diffs Are Written

A diff MUST be written for every modification that changes the file content. This includes all operations that generate an activity log entry (§7.7.2). A diff MUST NOT be written on task creation (the initial file content is the baseline).

### 8.5 Relationship to Activity Log

The activity log (§7.7) and history diffs (§8) are complementary:

| Aspect | Activity Log | History Diffs |
|--------|-------------|---------------|
| Location | Inside the task file | `history/<KEY>/` directory |
| Content | Field-level change summaries | Full unified diffs |
| Description changes | Line count summary | Actual content diff |
| Use case | Quick glance at what changed | Full audit / content recovery |
| Format | Human-readable markdown | Standard unified diff |
