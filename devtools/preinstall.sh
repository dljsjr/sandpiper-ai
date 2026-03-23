#!/usr/bin/env sh

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="${REPO_ROOT}/dist"

echo "⚙ ensuring root dist directory"
mkdir -p "${DIST_DIR}"

for element in extensions themes skills prompts packages; do
    echo "⚙ ensuring root dist subdirectory for ${element}"
    mkdir -p "${DIST_DIR}/${element}"
done
