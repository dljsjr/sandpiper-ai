#!/usr/bin/env bash
# Download vendored dependencies listed in vendor.txt.
#
# Usage:
#   vendor.sh              # Download all (replace existing)
#   vendor.sh --if-missing # Download only entries whose destination doesn't exist

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MANIFEST="$REPO_ROOT/vendor.txt"
FETCH="$SCRIPT_DIR/fetch-git-subdir.sh"

if_missing=false
if [ "${1:-}" = "--if-missing" ]; then
  if_missing=true
fi

if [ ! -f "$MANIFEST" ]; then
  echo "No vendor.txt found at $MANIFEST" >&2
  exit 1
fi

count=0
skipped=0

while IFS= read -r line || [ -n "$line" ]; do
  # Skip comments and blank lines
  line="${line%%#*}"
  line="$(echo "$line" | xargs)"
  [ -z "$line" ] && continue

  url="$(echo "$line" | awk '{print $1}')"
  dest="$(echo "$line" | awk '{print $2}')"

  if [ -z "$url" ] || [ -z "$dest" ]; then
    echo "Warning: skipping malformed line: $line" >&2
    continue
  fi

  # Resolve relative dest against repo root
  if [[ "$dest" == ./* ]]; then
    dest="$REPO_ROOT/${dest#./}"
  elif [[ "$dest" != /* ]]; then
    dest="$REPO_ROOT/$dest"
  fi

  if $if_missing && [ -d "$dest" ]; then
    skipped=$((skipped + 1))
    continue
  fi

  "$FETCH" "$url" "$dest"
  count=$((count + 1))
done < "$MANIFEST"

if [ $count -eq 0 ] && [ $skipped -gt 0 ]; then
  echo "All $skipped vendored entries already present."
elif [ $count -gt 0 ]; then
  echo "Downloaded $count vendored entry/entries."
fi
