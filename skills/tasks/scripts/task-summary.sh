#!/bin/bash
#
# task-summary.sh — Print a status summary for a task project
#
# Usage: task-summary.sh <tasks-dir> [project-key]
#
# If project-key is omitted, summarizes all projects.
#
# Examples:
#   task-summary.sh .sandpiper/tasks SHR
#   task-summary.sh .sandpiper/tasks

set -euo pipefail

TASKS_DIR="${1:?Usage: task-summary.sh <tasks-dir> [project-key]}"
PROJECT_KEY="${2:-}"

if [ ! -d "$TASKS_DIR" ]; then
  echo "Error: tasks directory not found: $TASKS_DIR" >&2
  exit 1
fi

# Determine which project directories to scan
if [ -n "$PROJECT_KEY" ]; then
  DIRS="$TASKS_DIR/$PROJECT_KEY"
  if [ ! -d "$DIRS" ]; then
    echo "Error: project not found: $DIRS" >&2
    exit 1
  fi
else
  DIRS=$(find "$TASKS_DIR" -mindepth 1 -maxdepth 1 -type d | sort)
fi

for project_dir in $DIRS; do
  project=$(basename "$project_dir")
  echo "=== $project ==="
  echo ""

  for status in "NOT STARTED" "IN PROGRESS" "NEEDS REVIEW" "COMPLETE"; do
    files=$(grep -rl "status: $status" "$project_dir" 2>/dev/null || true)
    if [ -z "$files" ]; then
      continue
    fi
    count=$(echo "$files" | grep -c "\.md$" 2>/dev/null || echo "0")

    if [ "$count" -gt 0 ]; then
      echo "$status ($count):"
      echo "$files" | while read -r f; do
        [ -z "$f" ] && continue
        key=$(basename "$f" .md)
        title=$(grep "^title:" "$f" | sed 's/title: "//' | sed 's/"$//')
        priority=$(grep "^priority:" "$f" | awk '{print $2}')
        kind=$(grep "^kind:" "$f" | awk '{print $2}')

        # Indent subtasks
        if echo "$f" | grep -q "/[A-Z]\{3\}-[0-9]*/"; then
          echo "    [$priority] $key ($kind): $title"
        else
          echo "  [$priority] $key ($kind): $title"
        fi
      done
      echo ""
    fi
  done
done
