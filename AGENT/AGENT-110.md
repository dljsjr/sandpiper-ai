---
title: "Normalize remaining dependency declarations"
status: COMPLETE
resolution: WONTFIX
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: USER
created_at: 2026-04-28T18:37:46.152Z
updated_at: 2026-11-19T18:58:29.576Z
---

# Normalize remaining dependency declarations

# Small dependency-normalization cleanup for sandpiper-ai

## Current scan results

The original inbox note was partially stale. Re-checking the current codebase found these remaining issues:

### 1. `packages/sandpiper-tasks-cli/package.json` still has two literal pins

```json
{
  "dependencies": {
    "@toon-format/toon": "2.1.0"
  },
  "devDependencies": {
    "@toon-format/cli": "2.1.0"
  }
}
```

Both should use catalog references. Proposed fix:

1. Add a root catalog section such as:

```json
"toon": {
  "@toon-format/toon": "2.1.0",
  "@toon-format/cli": "2.1.0"
}
```

2. Update `packages/sandpiper-tasks-cli/package.json` to use `catalog:toon` for both entries.
3. Run `bun install` and commit the lockfile update in the same change.

### 2. `ascii-motion-mcp` catalog entry is not exact-pinned

Current root catalog:

```json
"tooling": {
  "ascii-motion-mcp": "^2.1"
}
```

This may violate the repo's exact-pin convention. Decide whether to pin it exactly or explicitly document why this catalog entry intentionally floats within the 2.x line.

## No longer applicable from the original inbox note

- `@types/node` is already exact-pinned.
- `ascii-motion-mcp` is no longer a `file:../ascii-motion-mcp` sibling checkout dependency.

## Verification

- Scan package manifests for non-`catalog:` / non-`workspace:` package-level dependencies.
- Run `bun install` after manifest changes.
- Run `bun check`.

## Original inbox note

# Small dep-normalization cleanup for `~/git/sandpiper-ai`

## Summary
The workspace is **already 99% compliant** with the "exact pins + catalog references" convention. This is not a full dep audit — it is a two-line fixup plus two notes about the existing catalog.

## Scan results (2026-04-07)

### Violation 1 — `packages/sandpiper-tasks-cli/package.json` has two literal pins

```json
{
  "dependencies": {
    "@toon-format/toon": "2.1.0"
  },
  "devDependencies": {
    "@toon-format/cli": "2.1.0"
  }
}
```

Both should be `catalog:...` references. Every other dependency in every other package.json in this repo is already either a `catalog:*` or `workspace:*` reference.

Proposed fix:
1. In `package.json` (root), add a new catalog section (or reuse an existing one) with both `@toon-format/*` entries pinned exactly:

```json
"catalogs": {
  ...
  "toon": {
    "@toon-format/toon": "2.1.0",
    "@toon-format/cli": "2.1.0"
  }
}
```

2. Update `packages/sandpiper-tasks-cli/package.json` to reference `catalog:toon` for both entries.

3. Run `bun install` and commit the resulting `bun.lock` update as part of the same commit.

### Note 1 — `@types/node` in the `ts` catalog uses `*`

```json
"ts": {
  "typescript": "6.0.2",
  "@types/node": "*",       // <-- floats
  "@types/bun": "1.3.11"
}
```

This is the **only** wildcard version in the entire workspace. Rationale could be "`@types/node` should always follow the installed Node.js version", but that is a convention call — the repo rule seems to be exact pinning. Either:

- pin it exactly to a current version (safer, predictable, drift-free), or
- leave it wildcard **with a comment** explaining why this one dep is exempted from the convention.

### Note 2 — `ascii-motion-mcp` in the `tooling` catalog uses a `file:` reference

```json
"tooling": {
  "@biomejs/biome": "2.4.6",
  "ascii-motion-mcp": "file:../ascii-motion-mcp",
  "mcporter": "0.7.3",
  "canvas": "3.2.2"
}
```

`file:../ascii-motion-mcp` ties the workspace to a sibling checkout outside the repo. This is a legitimate local-development pattern for an unpublished sibling package, but it is worth flagging because:

- it is not strictly "exact pinning" by the normal reading of the rule,
- it will silently break for any contributor who does not have the sibling repo checked out at that exact relative path,
- if the sibling package is ever published to npm, this should be updated to the pinned registry version.

Either accept it as "local-only sibling dep, intentional" and document it with a comment, or move to a published version.

## Scope assessment

| Item | Scope |
|---|---|
| Violation 1 (@toon-format catalog) | ~5 minutes: edit two files + `bun install` + commit |
| Note 1 (@types/node wildcard) | decision only, then either pin or document |
| Note 2 (ascii-motion-mcp file ref) | decision only, then document or publish |

Not worth a dedicated audit pass. Best handled as a single small commit when next touching dep files.

## Out of scope here
- The `bun.lock` churn I was restoring from main earlier in the session was a separate issue (stale lockfile on main missing `sandpiper-standup-cli` workspace entries, regenerated on any `bun install`). That is a pre-existing main concern, not caused by or related to this dep convention work.

## Closed in backlog triage (2026-11-19)

The package and catalogs it names are gone; the single root package.json is exact-pinned.

---

# Activity Log

## 2026-04-28T18:37:46.196Z

- **description**: added (143 lines)

## 2026-11-19T18:58:28.876Z

- **description**: 143 lines → updated (147 lines)

## 2026-11-19T18:58:29.576Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: UNRESOLVED → WONTFIX
