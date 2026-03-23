#!/usr/bin/env bash
# Download a subdirectory from a GitHub repository using the tarball API.
#
# Usage: fetch-git-subdir.sh <github-url> <destination>
#
# The URL must be a GitHub tree URL:
#   https://github.com/{owner}/{repo}/tree/{ref}/{path}
#
# Example:
#   fetch-git-subdir.sh \
#     https://github.com/anthropics/skills/tree/main/skills/pdf \
#     ./skills/third-party/pdf

set -euo pipefail

if [ $# -ne 2 ]; then
  echo "Usage: $(basename "$0") <github-url> <destination>" >&2
  exit 1
fi

url="$1"
dest="$2"

if ! command -v gh &>/dev/null; then
  echo "Error: gh CLI is required but not installed." >&2
  exit 1
fi

# Parse: https://github.com/{owner}/{repo}/tree/{ref}/{path}
remainder="${url#https://github.com/}"
if [ "$remainder" = "$url" ]; then
  echo "Error: URL must start with https://github.com/" >&2
  exit 1
fi

owner_repo="${remainder%%/tree/*}"
after_tree="${remainder#*/tree/}"
owner="${owner_repo%%/*}"
repo="${owner_repo#*/}"
ref="${after_tree%%/*}"
path="${after_tree#*/}"
dirname="${path##*/}"

if [ -z "$owner" ] || [ -z "$repo" ] || [ -z "$ref" ] || [ -z "$path" ]; then
  echo "Error: Could not parse URL. Expected format:" >&2
  echo "  https://github.com/{owner}/{repo}/tree/{ref}/{path}" >&2
  exit 1
fi

# strip-components = number of segments in path
# (1 for the tarball's top-level dir + N-1 for parent dirs in path = N)
IFS='/' read -ra segments <<< "$path"
strip=${#segments[@]}

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

echo "Fetching $owner/$repo/$path@$ref..."
gh api "repos/$owner/$repo/tarball/$ref" \
  | tar xz -C "$tmpdir" --strip-components="$strip" "*/$path/*"

if [ ! -d "$tmpdir/$dirname" ]; then
  echo "Error: Expected directory '$dirname' not found after extraction." >&2
  exit 1
fi

rm -rf "$dest"
mkdir -p "$(dirname "$dest")"
mv "$tmpdir/$dirname" "$dest"

echo "✓ $dest"
