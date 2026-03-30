#!/usr/bin/env bash
# Post-install tasks: compile skill binaries and download external resources.
# Run automatically via `bun install` (postinstall) or manually.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="${REPO_ROOT}/dist"

# ─── Clean up dev-mode symlinks before rsync ───────────────────────
# Dev-mode symlinks in the source tree point into dist/. If rsync copies
# them into dist/, they become circular (symlink pointing to itself).
# Remove them first; they'll be recreated at the end of this script.

rm -f "${REPO_ROOT}/skills/sandpiper/tasks/scripts/sandpiper-tasks"
rm -f "${REPO_ROOT}/skills/sandpiper/dash/scripts/dash"

# ─── Package workspace distributions ───────────────────────────────

for element in extensions themes skills prompts packages; do
    echo "⚙ Copying ${element} packages for distribution"
    mkdir -p "${DIST_DIR}/${element}"
    rsync --exclude-from="${SCRIPT_DIR}/postinstall-excludes.txt" \
        -ahH \
        --delete \
        "${REPO_ROOT}/${element}/" "${DIST_DIR}/${element}/"
done

find . \( -name 'dist' -type d -not -path '*/node_modules/*' -not -path './dist' -not -path './packages/cli/*' -not -path './extensions/*' \) -print0 |
    xargs -0 -I{} sh -c 'rsync -ahH --exclude-from="$3" "$1/" "$(realpath "$2/$(dirname $1)/")"' - '{}' "${DIST_DIR}" "${SCRIPT_DIR}/postinstall-excludes.txt"

rsync --exclude-from="${SCRIPT_DIR}/postinstall-excludes.txt" -ahH "${REPO_ROOT}/packages/cli/dist/" "${DIST_DIR}/"
ln -sf "${DIST_DIR}/packages/sandpiper-tasks-cli/sandpiper-tasks" "${DIST_DIR}/skills/sandpiper/tasks/scripts/sandpiper-tasks"

# Copy extension package.json files back (excluded by rsync but needed
# by pi's package discovery to find extension entry points)
for ext_dir in "${REPO_ROOT}"/extensions/*/; do
    ext_name=$(basename "$ext_dir")
    if [ -f "${ext_dir}package.json" ]; then
        cp "${ext_dir}package.json" "${DIST_DIR}/extensions/${ext_name}/package.json"
    fi
done

echo "⚙ Generating CLI distribution package.json"
if (cd "${REPO_ROOT}/devtools" && bun ./distPackageJson.ts); then
    echo "✓ Generated distribution package.json"
else
    echo "⚠ Failed to generate distribution package.json"
fi

# Symlink pi's internal directories so getThemesDir() and getExportTemplateDir() work
# (resolves as PI_PACKAGE_DIR/dist/modes/... and PI_PACKAGE_DIR/dist/core/...)
# Resolve pi package location portably (works with bun, npm, pnpm, yarn)
# Find the package by searching node_modules for its package.json.
PI_PKG_DIR=$(node -e '
  const fs = require("fs"), path = require("path");
  function find(dir) {
    const candidate = path.join(dir, "node_modules", "@mariozechner", "pi-coding-agent");
    if (fs.existsSync(path.join(candidate, "package.json"))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    return find(parent);
  }
  const result = find(process.cwd());
  if (result) console.log(result);
  else { console.error("Could not find @mariozechner/pi-coding-agent"); process.exit(1); }
')

# For dev mode (PI_PACKAGE_DIR=repo): link dist/modes -> pi/dist/modes
rm -rf "$DIST_DIR/modes" "$DIST_DIR/core" "$DIST_DIR/dist"
ln -sf "$PI_PKG_DIR/dist/modes" "$DIST_DIR/modes"
ln -sf "$PI_PKG_DIR/dist/core" "$DIST_DIR/core"

# For dist mode (PI_PACKAGE_DIR=dist): link dist/dist -> dist
# This handles the double-dist expectation (dist/dist/modes -> dist/modes)
ln -sf "." "$DIST_DIR/dist"
echo "✓ Symlinked pi internal assets"

# ─── bundle configs ──────────────────────────────────────────────

echo "⚙ Copying configurations"
mkdir -p "${DIST_DIR}/config"

printf "\tCopying mcporter configurations\n"
rsync --exclude-from="${SCRIPT_DIR}/postinstall-excludes.txt" -ahH "${REPO_ROOT}/devtools/config/mcporter-dist.json" "${REPO_ROOT}/dist/config/mcporter.json"

# dash CLI (single-file devtools script)
DASH_BIN="$REPO_ROOT/dist/skills/sandpiper/dash/scripts/dash"
# Remove stale file/symlink before rebuilding (avoids circular symlink issues)
rm -f "$DASH_BIN"
if ! [ -f "$DASH_BIN" ]; then
    echo "⚙ Generating dash CLI..."
    mkdir -p "$(dirname "$DASH_BIN")"
    if (cd "${REPO_ROOT}/dist" && bun mcporter generate-cli --server dash --runtime node --bundle "$DASH_BIN" --minify); then
        if [ -f "$REPO_ROOT"/dist/dash.ts ]; then
            rm "$REPO_ROOT"/dist/dash.ts
        fi
        echo "✓ Generated dash CLI → $DASH_BIN"
    else
        echo "⚠ Could not generate dash CLI"
    fi
fi

# ─── Download external resources ─────────────────────────────────

GUIDE_PATH="$REPO_ROOT/dist/skills/sandpiper/skill-review/references/skill-building-guide.pdf"
GUIDE_URL="https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf"

if [ -f "$GUIDE_PATH" ]; then
    echo "✓ skill-building-guide.pdf already exists"
else
    echo "⬇ Downloading skill-building-guide.pdf..."
    mkdir -p "$(dirname "$GUIDE_PATH")"
    if curl -fSL -o "$GUIDE_PATH" "$GUIDE_URL"; then
        echo "✓ Downloaded skill-building-guide.pdf"
    else
        echo "⚠ Could not download skill-building-guide.pdf (network unavailable?)"
        echo "  You can download it manually:"
        echo "  curl -L -o '$GUIDE_PATH' '$GUIDE_URL'"
    fi
fi

# ─── Dev-mode symlinks ───────────────────────────────────────────
# Create symlinks in the source tree so skills resolve their companion
# binaries when running from the repo (not from dist).

echo "⚙ Creating dev-mode symlinks for skill binaries"
ln -sf "${DIST_DIR}/packages/sandpiper-tasks-cli/sandpiper-tasks" "${REPO_ROOT}/skills/sandpiper/tasks/scripts/sandpiper-tasks"
if [ -f "${DIST_DIR}/skills/sandpiper/dash/scripts/dash" ]; then
    ln -sf "${DIST_DIR}/skills/sandpiper/dash/scripts/dash" "${REPO_ROOT}/skills/sandpiper/dash/scripts/dash"
fi

# ─── Install Sandpiper Packages ─────────────────────────────────
if bun run "${DIST_DIR}/sandpiper" -- install "${DIST_DIR}"; then
    echo "✓ Successfully installed Sandpiper Package"
else
    echo "⚠ Failed to install Sandpiper Package"
fi
