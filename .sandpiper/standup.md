# Session Stand-Up

## Session 019e29ac-c41d-7013-994e-69ec7923d3f9 (Updated: 2026-05-16T13:22:24.975Z)

Session file: /Users/doug.stephen/.sandpiper/agent/sessions/--Users-doug.stephen-git-sandpiper-ai--/2026-05-15T03-27-28-797Z_019e29ac-c41d-7013-994e-69ec7923d3f9.jsonl

### Accomplished
- Built and iterated global Navigator extension at `/Users/doug.stephen/.sandpiper/agent/extensions/navigator/` with Watchman-backed file watching, hidden mode notifications, `navigator_comment` / `navigator_ignore`, user-only edit toggle, polished below-editor widget, and suggested edit rendering.
- Added Navigator LSP sidecar in `lsp.ts` and integration in `index.ts`:
  - `/navigator-lsp` and `/nav-lsp` commands.
  - `child_process.fork` sidecar startup.
  - sidecar publishes diagnostics, hover, code lens, and code actions for suggested edits.
  - sidecar writes `.navigator-lsp.json` with `{ version, pid, host, port }` for external clients.
- Added local Zed extension under `/Users/doug.stephen/.sandpiper/agent/extensions/navigator/zed/`:
  - `extension.toml`, `Cargo.toml`, `src/lib.rs`, `bin/navigator-lsp-stdio.ts`.
  - Zed extension maps Navigator LSP to TypeScript/TSX only for local tests.
  - Zed launches Bun bridge over stdio; bridge reads `.navigator-lsp.json` and connects to sidecar socket.
- Verified Zed/LSP slice end-to-end live: Navigator comments surfaced in Zed diagnostics/hover/code actions.
- Changed LSP diagnostic severity progression:
  - Initially comments=Hint, suggested edits=Information.
  - Tried Information across the board.
  - Final current behavior: Warning across the board because Zed/most IDEs do not emphasize below warning strongly enough.
- Captured a product learning: exact localized fixes should use `suggested_edit`, not just hunk comments. Need guidance tweak.
- Created/completed tasks through `NAV-35`; recent tasks `NAV-25`–`NAV-35` are `NEEDS REVIEW`.

### In Progress
- Need design/implementation for dismissing Navigator LSP diagnostics that no longer apply. Current diagnostics are sticky because entries persist in the sidecar and are only cleared on explicit sidecar clear/shutdown.
- Need tighten `navigator_comment` prompt guidance: prefer `suggested_edit` when the fix is exact/local/safe; use range/hunk comments for conceptual or ambiguous feedback.

### Next Session
- Continue in `/Users/doug.stephen/.sandpiper/agent/extensions/navigator/`.
- Read relevant files before editing: `index.ts`, `lsp.ts`, `zed/extension.toml`, `zed/src/lib.rs`, `zed/bin/navigator-lsp-stdio.ts`.
- For stale diagnostics, implement an invalidation model in `lsp.ts` and possibly forward document/file-change notifications from `index.ts`.
- Likely tasks to create: stale diagnostic invalidation, suggested-edit guidance tightening, and smoke tests for diagnostic clearing.
- Verify with Bun smoke scripts plus `cargo check`, `cargo build --target wasm32-wasip1`, and `sandpiper -p` load check.
- After `/reload`, live-test in Zed with `/navigator-lsp off` then `/navigator-lsp on` and Navigator comments.

### Blockers
- None. Main unknown: best invalidation heuristic for non-edit comments without dismissing useful conceptual diagnostics too aggressively.

### Context
- LSP diagnostic severities are Error=1, Warning=2, Information=3, Hint=4; current target is Warning=2 for all Navigator diagnostics.
- Zed LSP extensions are language-name scoped via `[language_servers.<id>].languages`; no documented wildcard/all-files mode found. Current local test maps TypeScript/TSX only.
- Current sidecar behavior:
  - `navigator_comment` forwards entries via parent/child IPC when `/navigator-lsp on`.
  - Sidecar stores entries in memory and republishes diagnostics for URI.
  - Suggested edit code actions are computed by finding `oldText` in current/open document text or on-disk text.
  - Existing diagnostics are not removed when user fixes the issue unless sidecar clears all entries.
- Important user preference: stop and ask on ambiguity, but for this stale diagnostics plan user asked for plan first, not implementation yet.
