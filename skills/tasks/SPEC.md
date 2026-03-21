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

### 2.3 Project Metadata

Each project directory MUST contain a `.meta.yml` file with the following fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `project_key` | string | MUST | The project key (e.g., `SHR`) |
| `next_task_number` | integer | MUST | The next task number to assign. MUST be initialized to `1` when the project is created. |

Example:

```yaml
project_key: SHR
next_task_number: 6
```

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
- The current counter value MUST be stored in the project's `.meta.yml` file (see §2.3).

### 3.3 Counter Operations

When creating a new task:

1. Read `next_task_number` from `.meta.yml`.
2. Use that value as the new task's number.
3. Increment `next_task_number` by one.
4. Write the updated `.meta.yml`.

These operations SHOULD be treated as atomic — do not create the task file without updating the counter, and do not update the counter without creating the task file.

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

A task file MUST open with YAML frontmatter, using the standard `---` delimiters. The markdown body MUST follow the closing `---` delimiter.

The markdown body MUST start with a level-1 heading (`# ...`) that matches the `title` field from the frontmatter.

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

1. Read the project's `.meta.yml` to obtain `next_task_number`.
2. Create the task file with all required frontmatter fields.
3. Set `created_at` and `updated_at` to the current timestamp.
4. Set `status` to `NOT STARTED`.
5. Increment `next_task_number` in `.meta.yml` and write it back.

If the project directory does not exist, it MUST be created along with its `.meta.yml`.

### 7.2 Status Transitions

There are no enforced state machine constraints on status transitions. Any status MAY transition to any other status. However, the following flow is RECOMMENDED:

```
NOT STARTED → IN PROGRESS → NEEDS REVIEW → COMPLETE
```

The `assignee` field SHOULD be updated in conjunction with status changes:
- When picking up a task: set `assignee` to `AGENT` or `USER`, set `status` to `IN PROGRESS`.
- When finishing work: set `status` to `NEEDS REVIEW`.
- When the user confirms completion: set `status` to `COMPLETE`.

### 7.3 Completion and Archival

Completed tasks (`status: COMPLETE`) MUST remain in place. They MUST NOT be automatically deleted or moved. Archiving completed tasks is an explicit, periodic operation performed by the user.

### 7.4 Modification

When any field or the markdown body of a task is modified, the `updated_at` field MUST be set to the current timestamp. The `created_at` field MUST NOT be modified after initial creation.
