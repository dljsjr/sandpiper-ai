#!/bin/bash
#
# task-pick-up.sh — Pick up a task (set status to IN PROGRESS, assignee to AGENT)
#
# Usage: task-pick-up.sh <task-file> [additional-task-files...]
#
# Examples:
#   task-pick-up.sh .sandpiper/tasks/SHR/SHR-9.md
#   task-pick-up.sh .sandpiper/tasks/SHR/SHR-9.md .sandpiper/tasks/SHR/SHR-9/SHR-10.md

set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: task-pick-up.sh <task-file> [additional-task-files...]" >&2
  exit 1
fi

TS=$(date -Iseconds)

for f in "$@"; do
  if [ ! -f "$f" ]; then
    echo "Warning: file not found, skipping: $f" >&2
    continue
  fi

  key=$(basename "$f" .md)
  sed -i '' "s/status: NOT STARTED/status: IN PROGRESS/" "$f"
  sed -i '' "s/assignee: UNASSIGNED/assignee: AGENT/" "$f"
  sed -i '' "s/updated_at: .*/updated_at: $TS/" "$f"
  echo "Picked up $key at $TS"
done
