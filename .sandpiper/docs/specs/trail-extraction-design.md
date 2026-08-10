# Trail Extraction — Design Record

Status: design record · Diátaxis: explanation + normative decisions · 2026-08-12

Record of the decisions behind extracting `packages/trail` into a standalone repository.
Decisions marked **[settled]** were ruled by Doug in the 2026-08-12 design session.
Items marked **[recommended]** are proposals that have not been ratified — do not treat
them as agreed.

## The finding that shapes everything

**Trail has no code coupling to Sandpiper.** Its five dependencies are all third-party
(`commander`, `@commander-js/extra-typings`, `@toon-format/toon`, `diff`, `yaml`), it
imports nothing from the workspace, and nothing in sandpiper-ai imports it as a library —
it appears only in turbo build filters, the lockfile, docs, and devtools tests.

What actually couples them is **16 hardcoded path literals** (plus about as many doc
comments) in `helpers.ts`, `storage-cmd.ts` (5×), `migrate.ts` (4×), `storage-config.ts`
(2×), `editor.ts`, and `index.ts`. They all spell one unnamed concept: *the task tree
lives at `<root>/.sandpiper/tasks`, configured by `.sandpiper-tasks.json` or the `tasks`
key in `.sandpiper/settings.json`.*

So this is not an untangling job. It is mostly introducing the constant that was never
introduced — worth doing on its own merits, since today changing that convention is a
16-site sweep with no compiler help.

Two supporting facts:

- **`dist/trail` is a portable Node bundle, not a native binary** — `#!/usr/bin/env node`,
  built `--target=node`, ~243KB. No build matrix, no per-platform artifacts.
- **sandpiper-ai's dependency on Trail is a build-artifact dependency, not a code
  dependency.** It needs a *file* at assembly time (`assembleDistribution.ts` copies
  `dist/packages/trail/trail` to six destinations) and a skill directory. It never resolves
  the module.

## Decisions

### Branding **[settled]**

Drop all Sandpiper branding from Trail. No aliases, no backwards compatibility, and Trail
does not know the old config format exists — not even for migration. The `sandpiper-tasks`
invocation alias in `index.ts` goes away with it.

Compatibility is a separate deliberate act performed by a separate tool. It is never
something the main binary quietly performs.

### Config resolution **[settled]**

Candidates, highest precedence first. **First match wins.** No merging, no walking up the
directory tree, no environment variable override.

1. `./.trail.json`
2. `./trail.json`
3. `./.trail/config.json`

Multiple candidates present is deliberate and legal, not an error: it lets a user clone a
repo carrying a version-controlled Trail config and shadow it with a local, uncommitted one
— e.g. working on a fork and tracking their own work on a separate board. Prior art is
mise's `mise.toml` / `mise.local.toml` family, cited as an existence proof that layered
filenames are fine, **not** as a template. Mise merges hierarchically because mise's
surface demands it; Trail's does not.

The `tasks` key inside `.sandpiper/settings.json` is dropped entirely.

### Path resolution **[recommended — agreed in substance, not explicitly ratified]**

Config discovery and the tasks-dir value both resolve against the **project root**, which
is what `--dir` already means today:

```ts
.option('-d, --dir <path>', 'Path to the directory containing .sandpiper/tasks (defaults to cwd)')
const tasksDir = join(base, '.sandpiper', 'tasks');   // helpers.ts:27
```

`--dir` points at the *container*, not at the tasks directory, so no behavior change is
required. Since discovery does not walk up, the project root is always either `--dir` or
cwd.

### Config content **[settled]**

- Default tasks dir is `./.trail/tasks`. Overriding it is a key in the config file.
- **Every key must be present. A missing key is an error.** No fallbacks, no inferred
  defaults, no merge-with-defaults pass. `resolveStorageConfig`'s `mergeWithDefaults` is
  deleted, not ported.
- No reserved escape-hatch key. Trail is simple; its config stays simple.

### Config versioning **[settled]**

The config carries a `version` integer. Trail carries its own expected version. **The two
must match exactly** — a file both newer *and* older than the binary is a loud error naming
the fix:

```
config version 1, trail expects 2 — run `trail migrate-config`
```

Accepting an older version was rejected because it requires the binary to know which keys a
past version lacked and supply them itself — the inferred fallback outlawed above, merely
relocated into the parser. `min_version`-style declarations (mise's approach) were
considered and rejected as surface disproportionate to Trail's complexity.

Side effect worth knowing: with the version check first, strictness about *unknown* keys
comes free and well-diagnosed. Any config carrying keys Trail does not know will also carry
a bumped version, so the version check fires first and produces a useful message instead of
`unexpected key "auto_stash"`.

### `initialize` **[settled]**

New top-level command. `storage init` is removed and folded into it — the `storage`
subcommand has poor discoverability and is confusing for most use cases.

- Emits `./.trail/config.json` with **all defaults explicitly populated**.
- **Never overwrites.** If a config already exists at any candidate path, `initialize` is a
  no-op consumer and fails loudly. An existing file means either `initialize` already ran or
  the user deliberately bootstrapped their own — neither is Trail's to clobber.

## Migration tool **[settled]**

A separate, throwaway CLI. It exists because we are currently Trail's only consumers; it is
our migration, not a Trail feature.

**It does not live in the Trail repo.** Keeping it in sandpiper-ai is what lets it read
`.sandpiper-tasks.json` and `.sandpiper/settings.json` — Sandpiper's formats — without Trail
ever knowing they existed. That ownership boundary is the whole reason Trail gets to be
compat-free.

Interface: `--tasks-dir`, and an optional `--config-file`. It emits `./.trail/config.json`
with the tasks-dir key pointed at the existing `./.sandpiper/tasks`. **Tasks are not
moved** — the point is to make old directories work in place, which keeps the migration
reversible and decouples "adopt standalone Trail" from "reorganize every repo".

It must carry the whole `version_control` block forward, not just the tasks dir. Surveyed
2026-08-12 across the twelve boards on this machine:

- **Eleven have a storage config**, so `--config-file` is the common case, not the rare one.
  It should *discover* the old config, with the flag as an override.
- **Five of twelve are partial** (missing `enabled`, `auto_push`, or both) — today's
  `mergeWithDefaults` is doing real work, so the old file is not a reliable source of every
  key.
- **`herdr` keeps its config in `.sandpiper/settings.json`**, not `.sandpiper-tasks.json`.
  Read both or it silently flips from `enabled: false` to enabled.
- **Seven of eleven task dirs are live jj workspaces** (`navigator`,
  `pi-claude-code-cli-provider`, `reinforced-guidance`, `sandpiper-ai`,
  `task-storage-spike`, `waymark`, `yaams`). Defaults say `mode.branch: "@"` (inline).
  Handing a fresh "you are inline" config to a real jj workspace is the one outcome here
  that can damage something rather than merely annoy.
- `reinforced-guidance` and `waymark` run `auto_commit: true`; everything else does not.

## Depending on Trail without publishing to npm **[recommended]**

Because the dependency is a build artifact rather than a module, this is not a
module-resolution problem. Ranked:

1. **Vendor it.** One line in `vendor.txt` pointing at a pinned ref of the Trail repo,
   pulling `SKILL.md` + the built `trail`. `devtools/vendor.ts` already does exactly this
   shape for the `pdf` and `skill-creator` skills. No npm, no lockfile entry, no dependency
   policy change, works under jj. Cost: Trail commits its built bundle — defensible for a
   repo whose deliverable *is* that bundle.
2. **Git dependency** (`git+ssh://…#v0.1.0`). Trips our own gate —
   `devtools/ecosystemPackage.ts` accepts only `file:`, exact semver, and allowlisted
   `workspace:` — and leans on install-time `prepare` scripts removed in TOOLS-15. Would
   still need assembly code reaching into `node_modules` to place the skill.
3. **`file:` path dep.** Permitted by the policy today, but only works on one machine.
4. **Git submodule + workspace entry.** Avoid. jj's submodule support is the weak spot, and
   we are jj-exclusive. Verify before believing this ranking.

## Sequencing **[recommended]**

**Do the decoupling in place, before the directory moves.** Introduce the config module,
generalize the roots, implement the new resolution and version rules, delete
`mergeWithDefaults` — all inside the monorepo, where the vitest suite, the distribution
smoke tests, and `assembleDistribution.ts` already exercise it. Get that green. *Then* the
physical move is a file copy plus a `vendor.txt` line, with nothing left to debug.

Inverted, every failure is ambiguous between "the extraction broke it" and "the
generalization broke it," and you are bisecting a repo split. There is no CI here to catch
it — there is no `.github/workflows`, so the distribution tests run only when run by hand.

Ordering constraint: the migration tool ships **before or with** the cutover. The moment
Trail stops reading `.sandpiper/tasks`, every board on this machine is dark until migration
runs against it.

## Prior work

TCL-69 and its subtasks (TCL-122 rename, TCL-123 binary, TCL-127 distribution verification,
TCL-128 package directory groundwork) are COMPLETE, but the rename was **surface-deep**: new
name outside, `.sandpiper` everywhere inside. There is no `.trail` string anywhere in the
package today. None of those tickets touch path generalization, config resolution, or the
external-repo dependency — which is where the actual work is.
