#!/usr/bin/env sh

SCRIPT_DIR="$(cd "$(dirname "${0}")" && pwd)"
mkdir -p "${SCRIPT_DIR}/dist"

PI_BIN="$(command -v pi 2>&1)"
if [ -n "$PI_BIN" ]; then
    printf "%s\n" "${PI_BIN}" >"${SCRIPT_DIR}/dist/.pi-binpath"
fi
