# Agent Journal v1 specification

Status: agreed design, not implemented. Task: TOOLS-50. Background: [standup safety review](standup-review-2026-10-26.md).

This document records the decisions from the journal design discussion. The standalone `agent-journal` repository now carries the implementation reference in `docs/spec.md` and the session handoff in `HANDOFF.md`. This copy preserves the agreed design and Sandpiper integration boundary.

## Purpose and scope

Journal provides compact continuation context for agents entering a new context window. Independent, top-level agents can publish updates concurrently in the same working directory. A parent agent or subagent hierarchy is not required.

The tool is a bounded activity journal, not complete working memory, a task tracker, or an identity system. Short entries point to tasks, documents, and session records when more detail is needed.

The standalone repository is named `agent-journal`. Both the CLI and the skill are named `journal`. The standalone implementation and skill contain no Sandpiper-specific behavior. The user approved standalone ownership rather than another in-repository standup CLI rewrite.

Reinforced guidance, project-local YAAMS, session-history search, and Stint remain separate longer-term context-retrieval ideas. They are not dependencies of this stopgap.

## Runtime and distribution

The implementation uses Node-compatible TypeScript. Bun is preferred for development and package management, but the distributed tool must not require Bun APIs or a Bun shebang.

The distribution goal is a source script under the skill's `scripts/` directory, without a build step. Commander and Chrono are ordinary JavaScript dependencies. No native npm addon, handwritten FFI binding, or database is selected.

Node 24+ is the approved baseline. The user created the standalone repository with `mise.toml` selecting `node = "lts"`, currently Node 24.22.1. A source `.ts` script ran successfully under that Node version during feasibility tests. The final dependency-installation layout is not selected yet. Do not assume that publishing to npm, adding a release pipeline, or supporting every installation layout is part of the MVP.

## Journal location

The selected directory comes from the first available source:

1. Explicit `--dir <path>`.
2. `AGENT_JOURNAL_DIR`.
3. `.agent-journal/` relative to the invocation's current working directory.

The filename is always `journal.md`. `--dir` replaces the earlier proposal for `--file`. There is no separate filename setting in the agreed v1 design.

### Sandpiper integration

Sandpiper supplies `AGENT_JOURNAL_DIR` as the absolute path of the active project's `.sandpiper` directory. It supplies the value before tool or provider subprocesses launch, so normal environment inheritance carries it to the CLI.

Sandpiper preserves an existing user-supplied value. Explicit `--dir` still takes precedence.

This gives Sandpiper `.sandpiper/journal.md` without making the standalone CLI discover or recognize Sandpiper. An absolute environment value keeps the location stable when a child command changes directories.

## Write command

`journal write` takes exactly one required positional argument containing the entry. Multiword entries require shell quoting. Excess positional arguments are errors.

Example:

```text
journal write --author alice 'Finished ISO date handling. Details: docs/date-parsing.md'
```

The CLI normalizes the supplied content before applying its length limit:

1. Replace line breaks with ordinary spaces, preserving word boundaries.
2. Trim surrounding whitespace.
3. Reject empty content.
4. Reject normalized content longer than 500 characters.

Other internal whitespace remains unchanged. Multiline quoted input is accepted and flattened rather than rejected. Each stored entry is one physical Markdown list item.

The 500-character limit covers content only, not generated timestamps or author metadata. The precise counting unit was not separately ratified. The size discussion assumed Unicode code points, with one to four UTF-8 bytes each.

### Attribution

`--author <label>` is optional explicit attribution. If omitted, there is no inferred author.

An author label does not establish ownership. There is no author registry, process identity, session identity, harness detection, or automatic identity lookup.

The CLI owns metadata generation and encoding. Entry authors supply content and flags, not serialized metadata.

## Storage and retention

The journal is newest first, with generated date headers and regular Markdown list entries. A write adds an entry at the top. Existing entries are immutable while retained.

The journal retains at most 200 entries across all dates and authors. If a write exceeds that ceiling, it drops the oldest entries. If a day becomes empty, its header is removed.

Retention is count-based, not age-based. Idle time does not expire entries. This is an explicitly lossy recent-activity buffer, with generous enough retention for the intended personal workflow.

The exact serialized metadata layout is not selected yet. It must round-trip normalized content and author labels without confusing content with entry or header boundaries. An unrecognized or partially parsed file must not be silently rewritten as a smaller recognized subset.

## Time and date handling

Day headers and date filters use the invoking machine's configured timezone, including on remotes. A remote configured for UTC uses UTC. Entry timestamps include the UTC offset.

### Filter arguments

The MVP includes both flags:

- `--date <date>` selects one exact local calendar day.
- `--since <date>` selects that local calendar day and all later days, inclusively.

The flags are mutually exclusive. Commander supports this directly through `Option.conflicts()`.

Accepted input is described as ISO dates and common English relative dates, not full GNU date compatibility. `YYYY-MM-DD` is the agreed ISO calendar-date form. Other ISO forms were not explicitly selected.

### Parsing dispatch

The agreed dispatch keeps ISO handling outside Chrono's fuzzy pipeline:

1. Recognized ISO format goes through native ISO handling with the agreed local-time interpretation.
2. Other input goes through Chrono, with one complete, non-range match required.

The ISO gate checks format, not actual calendar validity. The user explicitly accepted JavaScript's calendar normalization. Do not add a separate days-per-month or leap-year validator.

For example, normalization of February 30 into March is acceptable for this CLI. Recognized ISO input that native handling cannot parse is an error, not an invitation for fuzzy reinterpretation.

Do not directly pass a date-only string to `Date.parse()` and then read its local calendar fields. Native parsing treats `YYYY-MM-DD` as UTC midnight, which can shift the local date backward. The ISO path must retain the selected local-calendar semantics.

The user offered the regex-first timestamp parser in `pi-yaams` as a starting point. It currently requires a full timestamp with an offset and normalizes to UTC. Reuse its approach rather than copying that full contract unchanged.

### Chrono behavior

`chrono-node` 2.10.3 was tested under Node. Its English entry point supports ISO dates and common relative expressions without runtime dependencies of its own.

For relative input, trim the argument, call `parse()`, and require all of the following:

- Exactly one result.
- A result starting at index zero.
- Matched text equal to the complete trimmed argument.
- No range endpoint.

Chrono's `end` field can be null or undefined. A guard that requires `end === undefined` rejects some ordinary single-date results.

Use `parse()`, not `parseDate()`, because the CLI needs match boundaries and range information. Whole-input matching prevents extraction from surrounding junk, but it does not prove that every fuzzy interpretation is correct.

Chrono runs all configured parsers and then applies refiners. Adding an ISO parser first does not short-circuit casual parsing. The user approved an ordinary ISO fast path plus Chrono fallback instead of custom Chrono parsers/refiners.

Feasibility tests accepted `yesterday`, `last Monday`, `last Friday`, `2 days ago`, `2 weeks ago`, `last week`, `-3 days`, and `today - 2 days`. Exact supported examples still need repository regression tests. Use a fixed reference time in those tests.

## Read command

Reads never consume, modify, prune, or clean journal data.

### Default selection

Without an explicit date flag:

1. Apply the author filter, if supplied.
2. Select the newest recorded day among the matching entries.
3. Return that day's entries newest first, subject to the read limit.

The default is the newest recorded day, not necessarily today. Older days are not added to fill the allowance.

If Alice last wrote Friday and Bob wrote Monday, `read --author Alice` selects Alice's Friday entries rather than an empty Monday view.

### Explicit date selection

`--date` and `--since` override the latest-day default. In particular, `--since` can return matching entries across several days.

Author filtering, newest-first ordering, and the read limit still apply.

### Read limit

The default read limit is 20 entries. `--limit <n>` accepts a positive integer and overrides that default. Increasing the limit does not change the selected date window.

Example:

```text
journal read --since yesterday --limit 100
```

At most the retained matching entries are available. The storage ceiling remains 200 entries.

If the read limit truncates matching entries, the output states how many entries were omitted. Omission reporting applies to the selected author and date window.

## Concurrent publication

All CLI writers cooperate through an advisory kernel lock. Direct manual edits can bypass that lock.

The selected mechanism uses system utilities rather than native npm addons or FFI:

- macOS: `/usr/bin/lockf`.
- Linux: `/usr/bin/flock`, supplied by `util-linux`.

The user confirmed that the Linux remotes in regular use include `/usr/bin/flock` in their base systems. Missing utilities must produce a clear failure, not a weaker fallback protocol.

Node opens a separate, persistent lock file and passes its descriptor to the utility as child descriptor 3. The utility's descriptor form acquires the lock and exits. Node retains the same open file description, so the lock remains held during the update.

The entire read, parse, prepend, retention, and replacement operation runs while holding the lock. Use a unique temporary file in the journal's directory and atomically replace the journal. Node closes the lock descriptor in `finally`.

The lock file is not deleted, replaced, or treated as evidence of an owner. No PID registry, stale-file scavenging, heartbeat, or lease timeout is needed.

The utility waits for a bounded period when acquiring the lock. The timeout value and error-message details remain implementation choices. No user-facing timeout flag was approved.

macOS descriptor acquisition uses the form `lockf -s -t <seconds> 3`. Descriptor mode implies keeping the lock file. Path-and-command mode requires `-k` to avoid unlinking it.

Linux descriptor acquisition uses the form `flock -x -w <seconds> 3`.

The Node descriptor-retention mechanism was tested on macOS. Another process remained excluded after `lockf` exited and could acquire the lock after Node closed its descriptor. Linux execution still needs verification. The initial scope assumes local filesystem behavior, not network-filesystem guarantees.

## Skill behavior

The skill emphasizes continuous, focused updates rather than periodic massive handoffs.

Each entry discusses one meaningful development. Decisions, discoveries, blockers, and changes to the next action are useful triggers. Routine tool calls are not entries by themselves.

Detailed analysis belongs in an appropriate task or document, referenced from the entry. A short entry is a breadcrumb, not a requirement to reconstruct the whole session in 500 characters.

The skill teaches the CLI workflow and does not ask agents to construct metadata directly. It remains harness agnostic.

## Legacy boundary and current state

Leave the existing `.sandpiper/standup.md` unchanged. No migration or deletion of its contents is authorized by this design.

The user created the standalone repository as a colocated jj/Git repository. It contains the user-provided `mise.toml` and the design/handoff documents. No journal CLI, skill implementation, or Sandpiper environment integration exists yet. Sandpiper tasks TOOLS-47 and TOOLS-50 track the review and design checkpoint.

Removal of the old bundled CLI/skill, changes to its documentation and build wiring, and the exact transition sequence still need implementation scope. Do not infer authorization to delete them from approval of individual journal design choices.

No further product decisions were identified as blocking v1. The remaining mechanical details include the exact Markdown metadata layout, empty/missing-file output, author matching details, and runtime installation layout. Prefer simple defaults rather than expanding the feature set. Further product decisions require user input only when they present a meaningful tradeoff.
