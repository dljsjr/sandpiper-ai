#!/bin/bash
#
# task-complete.sh — Mark a task as NEEDS REVIEW (or optionally COMPLETE)
#
# Usage: task-complete.sh [--complete] <task-file> [additional-task-files...]
#
# By default, sets status to NEEDS REVIEW (agent finished, user should confirm).
# With --complete, sets status directly to COMPLETE.
#
# Examples:
#   task-complete.sh .sandpiper/tasks/SHR/SHR-9.md
#   task-complete.sh --complete .sandpiper/tasks/SHR/SHR-9.md

set -euo pipefail

TARGET_STATUS="NEEDS REVIEW"
if [ "${1:-}" = "--complete" ]; then
  TARGET_STATUS="COMPLETE"
  shift
fi

if [ $# -eq 0 ]; then
  echo "Usage: task-complete.sh [--complete] <task-file> [additional-task-files...]" >&2
  exit 1
fi

TS=$(date -Iseconds)

for f in "$@"; do
  if [ ! -f "$f" ]; then
    echo "Warning: file not found, skipping: $f" >&2
    continue
  fi

  key=$(basename "$f" .md)
  # Update status from whatever it currently is
  sed -i '' "s/status: .*/status: $TARGET_STATUS/" "$f"
  sed -i '' "s/updated_at: .*/updated_at: $TS/" "$f"
  echo "Marked $key as $TARGET_STATUS at $TS"
done
