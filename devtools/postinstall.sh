#!/usr/bin/env bash
# Post-install tasks: compile skill binaries and download external resources.
# Run automatically via `bun install` (postinstall) or manually.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ─── Compile skill binaries ──────────────────────────────────────

# sandpiper-tasks CLI (workspace package with its own build script)
TASKS_BIN="$REPO_ROOT/skills/sandpiper/tasks/scripts/sandpiper-tasks"
if [ -f "$REPO_ROOT/packages/sandpiper-tasks-cli/package.json" ]; then
  echo "⚙ Compiling sandpiper-tasks CLI..."
  if (cd "$REPO_ROOT/packages/sandpiper-tasks-cli" && bun run build) 2>/dev/null; then
    echo "✓ Compiled sandpiper-tasks CLI → $TASKS_BIN"
  else
    echo "⚠ Could not compile sandpiper-tasks CLI"
  fi
fi

# dash CLI (single-file devtools script)
DASH_SRC="$REPO_ROOT/devtools/dash.ts"
DASH_BIN="$REPO_ROOT/skills/sandpiper/dash/scripts/dash"
if [ -f "$DASH_SRC" ]; then
  echo "⚙ Compiling dash CLI..."
  mkdir -p "$(dirname "$DASH_BIN")"
  if bun build --compile --target bun "$DASH_SRC" --outfile "$DASH_BIN" 2>/dev/null; then
    echo "✓ Compiled dash CLI → $DASH_BIN"
  else
    echo "⚠ Could not compile dash CLI"
  fi
fi

# ─── Download external resources ─────────────────────────────────

GUIDE_PATH="$REPO_ROOT/skills/sandpiper/skill-review/references/skill-building-guide.pdf"
GUIDE_URL="https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf"

if [ -f "$GUIDE_PATH" ]; then
  echo "✓ skill-building-guide.pdf already exists"
else
  echo "⬇ Downloading skill-building-guide.pdf..."
  mkdir -p "$(dirname "$GUIDE_PATH")"
  if curl -fSL -o "$GUIDE_PATH" "$GUIDE_URL" 2>/dev/null; then
    echo "✓ Downloaded skill-building-guide.pdf"
  else
    echo "⚠ Could not download skill-building-guide.pdf (network unavailable?)"
    echo "  You can download it manually:"
    echo "  curl -L -o '$GUIDE_PATH' '$GUIDE_URL'"
  fi
fi
