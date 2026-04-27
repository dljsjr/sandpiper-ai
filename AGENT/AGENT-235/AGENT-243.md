---
title: "Compile-pathway hardening for the standalone app"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: "sandpiper-0.84-dev"
reporter: AGENT
created_at: 2026-08-06T20:42:18.566Z
updated_at: 2026-08-07T00:43:26.018Z
---

# Compile-pathway hardening for the standalone app

Adopt the --no-compile-autoload-bunfig equivalent in devtools/standaloneSandpiperApp.ts Bun.build({compile:true}) - upstream #7684: a cwd bunfig.toml with preload scripts crashes compiled Bun binaries; the flag landed on pi main just after the v0.84.0 tag. Check whether the Bun.build JS API exposes it; if not, shell out to bun build --compile like upstream scripts/build-binaries.sh. Note -baseline targets for any future x64 artifacts (#7390 AVX2 crash class).

No structural simplification is available: verified at v0.84.0 that Pi still ships binary + sidecar assets with getPackageDir() = dirname(process.execPath) in compiled mode; the PI_PACKAGE_DIR + generated package dir mechanism remains necessary. Optional: extend our BUN_EMBEDDED_FILESYSTEM_ROOT check (/$bunfs/ only) to the ~BUN / %7EBUN variants Pi matches, if Windows compiled builds ever matter.

---

# Activity Log

## 2026-08-07T00:18:49.609Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → sandpiper-0.84-dev

## 2026-08-07T00:43:25.956Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-08-07T00:43:26.019Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
