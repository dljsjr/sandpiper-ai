#!/bin/bash
#
# task-create.sh — Create a new task file with proper frontmatter
#
# Usage: task-create.sh <tasks-dir> <project-key> <kind> <priority> <title> [parent-key]
#
# Arguments:
#   tasks-dir    Path to the .sandpiper/tasks directory
#   project-key  3-letter project key (e.g., SHR)
#   kind         TASK, BUG, or SUBTASK
#   priority     LOW, MEDIUM, or HIGH
#   title        Task title (quoted)
#   parent-key   Parent task key (required for SUBTASK, e.g., SHR-1)
#
# Examples:
#   task-create.sh .sandpiper/tasks SHR TASK HIGH "Implement FIFO manager"
#   task-create.sh .sandpiper/tasks SHR SUBTASK HIGH "Write unit tests" SHR-1

set -euo pipefail

TASKS_DIR="${1:?Usage: task-create.sh <tasks-dir> <project-key> <kind> <priority> <title> [parent-key]}"
PROJECT_KEY="${2:?Missing project key}"
KIND="${3:?Missing kind (TASK|BUG|SUBTASK)}"
PRIORITY="${4:?Missing priority (LOW|MEDIUM|HIGH)}"
TITLE="${5:?Missing title}"
PARENT_KEY="${6:-}"

# Validate kind
case "$KIND" in
  TASK|BUG|SUBTASK) ;;
  *) echo "Error: kind must be TASK, BUG, or SUBTASK" >&2; exit 1 ;;
esac

# Validate priority
case "$PRIORITY" in
  LOW|MEDIUM|HIGH) ;;
  *) echo "Error: priority must be LOW, MEDIUM, or HIGH" >&2; exit 1 ;;
esac

# Validate project key format
if ! echo "$PROJECT_KEY" | grep -qE '^[A-Z]{3}$'; then
  echo "Error: project key must be exactly 3 uppercase letters" >&2
  exit 1
fi

# Subtasks require a parent
if [ "$KIND" = "SUBTASK" ] && [ -z "$PARENT_KEY" ]; then
  echo "Error: SUBTASK requires a parent-key argument" >&2
  exit 1
fi

# Ensure project directory and meta file exist
PROJECT_DIR="$TASKS_DIR/$PROJECT_KEY"
META_FILE="$PROJECT_DIR/.meta.yml"

if [ ! -d "$PROJECT_DIR" ]; then
  mkdir -p "$PROJECT_DIR"
  cat > "$META_FILE" << EOF
project_key: $PROJECT_KEY
next_task_number: 1
EOF
fi

# Read and increment task number
TASK_NUM=$(grep "^next_task_number:" "$META_FILE" | awk '{print $2}')
TASK_KEY="$PROJECT_KEY-$TASK_NUM"
NEXT_NUM=$((TASK_NUM + 1))

# Determine file path
if [ "$KIND" = "SUBTASK" ]; then
  SUBTASK_DIR="$PROJECT_DIR/$PARENT_KEY"
  mkdir -p "$SUBTASK_DIR"
  TASK_FILE="$SUBTASK_DIR/$TASK_KEY.md"
else
  TASK_FILE="$PROJECT_DIR/$TASK_KEY.md"
fi

# Generate timestamp
TS=$(date -Iseconds)

# Write the task file
cat > "$TASK_FILE" << EOF
---
title: "$TITLE"
status: NOT STARTED
kind: $KIND
priority: $PRIORITY
assignee: UNASSIGNED
reporter: AGENT
created_at: $TS
updated_at: $TS
---

# $TITLE

EOF

# Update meta
sed -i '' "s/next_task_number: .*/next_task_number: $NEXT_NUM/" "$META_FILE"

echo "Created $TASK_KEY: $TITLE"
echo "  File: $TASK_FILE"
