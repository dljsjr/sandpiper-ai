# Durable Tattler Message Log — Sizing Pass

> Restored 2026-11-19 from change `xqlzzyls` (commit `c8638029`), which was abandoned on 2026-09-08 before it reached the main line. Written against the May 2026 code; check paths and APIs against the current tree before implementing. The durable log is part of Tattler v1, which is the long-term goal and not current work (Doug, 2026-11-19). `mailbox-coordination-architecture-notes.md` now lives in `.sandpiper/archive/`.

**Date:** 2026-05-26 (updated 2026-05-27)
**Owner:** Piper (Librarian) — synthesis
**Inputs:** Muninn (framing provenance + lived friction), Huginn (queue/abort/drain seam behavior — categories named, detailed notes to follow)
**Question:** Is the abort+resume message re-delivery bug worth patching, or should we supersede it by pulling the deliberately-deferred durable-rooms phase forward? And if the latter — how big is that work, really?

> **Session update 2026-05-27:** Key reframings from the room "tattler durable chats refactor" session with Doug, Huginn, and Muninn are annotated throughout with `[2026-05-27]` markers. The headline and structural framing have been updated to reflect the Tattler-layer scope decision.

---

## Headline

The patch-vs-supersede framing is a **false binary**. The spec's deferred "Broadcast MVP" is a _superset_ aimed at cross-project broadcast channels. The thing that actually fixes the re-delivery bug is a **narrower targeted slice** — _durable Tattler message log + per-agent read cursors_ — which both retires the bug at its root and advances the accepted architectural north star, without committing to the full Broadcast MVP.

In short: the right "patch" and the first real slice of "supersede" are the **same work**.

`[2026-05-27]` **Scope reframed from Chorus to Tattler layer.** While Chorus inspired this work, the durability primitive lives at the Tattler layer — Tattler owns the pipe and the persistence of that pipe. Chorus consumes the durable substrate for coordination semantics (broker, fanout, audience). This prevents dependency inversion where the group-messaging layer owns the primitive the transport needs.

---

## What's decided / de-risked

This is not greenfield. The direction has accepted decisions behind it:

- **AGENT-201 (COMPLETE):** full mailbox-coordination architecture review; all key changes have accepted decisions. Spec: `.sandpiper/docs/specs/mailbox-coordination-architecture-notes.md` (1547 lines, Decision Log).
- **It was sequenced on purpose.** Key Change 4 is titled _"Live same-host routing first, durable scoped logs next."_ Key Change 2 ("durable conversations as product center") was accepted _with reframing_ → ephemeral DMs as MVP, durable coordination deferred. Decision Log 2026-05-14: "Treat Broadcast MVP as a near-term post-MVP backlog item."
- **Provenance (Muninn):** the "inbox-as-view-not-storage" framing came from the 2026-05-26 Chorus queue-recovery dogfood, where Doug re-pointed the team at the spec and framed it as an _"important old decision, newly urgent" — the architectural north star the MVP pending-inbox delivery was always pointing toward._ It was intent, not stopgap. That changes how we read the deferral: deferred-by-plan, not deferred-by-doubt.
- **Earned pattern (Piper, `patterns.md`):** _Log as truth, inbox as projection_ — durable append-only log is truth; inbox/unread is a cursor projection over it; live notifications are wake/render hints, not payload custody. The spec's KC4/KC5 and this pattern agree.
- **Storage mandate (Decision Log):** use established, inspectable formats (JSONL / SQLite / DuckDB), never a custom format requiring bespoke UI.
- **Trust boundary:** same-host, same-user. No networking, no distributed log.
- **Record shape sketched (KC5 decision status):** compact immutable append record with id, timestamp, sequence/order, channel/scope, author provenance, handle/audience snapshot, reply/branch metadata, typed references.

## Why the narrow slice ≠ Broadcast MVP

My own memory note (2026-05-26) already flagged this: _"TAT-10 is too broad/low-priority as 'Broadcast MVP.' The nearer next slice should be durable Chorus room history + per-agent read cursors."_

| Broadcast MVP (TAT-10, deferred superset)                | Targeted slice (fixes the bug)                        |
| -------------------------------------------------------- | ----------------------------------------------------- |
| User-global + cwd/project broadcast scopes               | Single existing Chorus room log                       |
| Startup channel presence / floating cross-project agents | (not needed)                                          |
| post / list / read / reply / reference tool suite        | One `read-from-cursor` read API + existing reply path |
| Storage config surface, cwd-derivation, channel naming   | One storage backend decision, room-scoped             |
| Cross-channel coordination, Trail task-state interaction | (deferred)                                            |

The targeted slice is the **core primitive** (append-only log + per-agent cursor) applied to the room we already have. Broadcast MVP is that primitive generalized across scopes — later.

## Targeted slice — implementable chunks

1. **Append-only room log + record schema.** Compact immutable records; one room log as source of truth. _(Gated on storage-backend OQ.)_ `[2026-05-27]` **SQLite driver = `better-sqlite3`** (not `bun:sqlite`) for runtime-agnostic distribution. `bun:sqlite` bundles crash under Node (`ERR_UNSUPPORTED_ESM_URL_SCHEME` on `bun:` protocol); compiled Bun binaries are too large. Bun for dev, but distributed packages must run under Node. **Migration strategy = simple/manual**: `_migrations` table + ordered SQL files, no migration library.
2. **Stable room post IDs + audience snapshot at append.** Overlaps work already in flight — TAT-39 / TAT-50 (broker-owned participant/audience snapshot). Reuse, don't rebuild.
3. **Per-agent read cursor: persistence + advance-on-handle, durable through abort/resume.** _This chunk is the bug fix._ The re-delivery symptom is exactly a cursor that doesn't persist through abort, so `before_agent_start` re-drains an already-drained inbox. `[2026-05-27]` **Cursor advance is batch-atomic on tool-call success, not per-message.** Per-message advance was considered and rejected: it fixes over-delivery but creates under-delivery (partial failures silently drop already-processed messages), which is TAT-37 territory. Batch-atomic means delivered-but-uncommitted messages re-deliver on resume (correct); committed messages never re-deliver (kills the bug).
4. **`read-from-cursor` unread API/tool.** Correctness via "read since my cursor," replacing pending-batch reconstruction. `[2026-05-27]` **Explicit-fork only for MVP.** Agent calls `read-from-cursor` when ready; no auto-deliver at turn start. Makes reasoning about state simple, observable, debuggable. Matches standalone TUI interaction model (show N unread, agent reads on demand). Auto-deliver can be added later as opt-in.
5. **Demote live nudge to wake/render hint.** Rewire Chorus delivery so the live notification carries no payload custody — the log + cursor own correctness.
6. **Compatibility fallback.** Keep the pending-batch path as a migration fallback so nothing regresses during cutover.

A partial landing of chunks 1–4 alone delivers the bug fix, even before the full nudge-demotion rewire.

## Open questions — load-bearing vs deferrable

**Load-bearing for the targeted slice (must resolve before coding):**

1. **Storage backend.** ✅ **RESOLVED — SQLite** (Doug, 2026-05-26, after diligence). Daemons (NATS JetStream / Redis Streams) rejected as single-host overkill; RocksDB/LSM dropped (optimizes write-throughput we don't have at room scale, and would mean rebuilding ACID + cursor semantics); Redb pruned by the spec's inspectability mandate. SQLite: embedded, ACID, `sqlite3`-inspectable, single file.
2. **Record schema.** ✅ RESOLVED — bootstrap from the current Chorus message JSON (it's solid); migrations from day 1 so schema evolution is cheap. (Doug, 2026-05-26) `[2026-05-27]` **agentId = Tattler ID for MVP** (not `birdup --init` UUID). birdup already soft-enforces persistent identity; ephemeral agents don't need a stable directory identity. Schema is UUID-compatible (same column type, same FK relationship) for directory rollout later — swap key type, no migration. **Migration strategy = simple/manual**: `_migrations` table + ordered SQL files, no migration library.
3. **Sequence allocation.** ✅ RESOLVED — two columns, two jobs: **UUIDv7** as the globally-stable post id; a **SQLite rowid `seq` integer** as the cursor range-query key (`WHERE seq > :cursor`). SQLite's transaction serialization gives monotonic insertion order regardless of UUIDv7's millisecond-granularity sort. Lamport clocks rejected as distributed-systems overkill on a single host. (Doug + Huginn + Muninn, 2026-05-26)
4. **Cursor persistence + advance semantics.** ✅ RESOLVED — per-agent cursor lives in a **SQLite `cursors` table** (agent × room → last_seq), _not_ Pi `appendEntry`/session files (the thing we're escaping). **Advance the cursor on tool-call _success_, not on delivery** — the tool-call boundary is the atomicity seam. Abort/resume is then safe by construction: messages delivered-but-not-committed never advance the cursor (re-deliver on resume, correct); committed messages never re-deliver (kills the bug). _Spec double-check:_ durable read/ack cursors appear in the architecture spec **only on its deferred lists** (lines 598, 940) — never designed — so this was genuinely unresolved; resolved here. (Doug + Huginn + Muninn, 2026-05-26) `[2026-05-27]` **Batch-atomic advance, not per-message.** Per-message advance was considered and rejected (Huginn proposed, Piper + Muninn pushed back): it fixes over-delivery but creates under-delivery on partial failure (TAT-37 territory). Batch-atomic on tool-call success is the invariant.
5. **Immutability.** ✅ RESOLVED — immutable append-only, no UPDATE/DELETE. Not building Slack edit/delete; mutability would make cursor management far harder. (Doug, 2026-05-26)

**All five load-bearing open questions are now resolved.** The targeted slice is design-complete pending the team spec review Doug called for before ticket breakdown.

**Deferrable (Broadcast-MVP-only — do NOT let them inflate this slice):**

- Global/project scope modeling, cwd-derivation, channel naming.
- Startup presence / broadcast participation directory.
- Broadcast tool suite (post/list/reply/branch across channels).
- Conversation ↔ Trail task-state interaction.
- Thread/branch metadata richness (`parentMessageId` / `branchRootId`).
- Typed vs freeform references.

## Lived-experience cross-check (behavioral, not spec-level)

From Muninn's session observations (corroborated by Huginn):

1. **Turn fragmentation** — every inbound message triggers a turn per participant even when the answer is silence (~15 `done` calls burned today). Scheduling geometry, not protocol-fixable; but durable rooms with batched fan-out could change the geometry. _Sizing note: this is adjacent, not in the targeted slice — flag for TAT-64 / a turn-scheduling ticket._
2. **Re-delivery after abort** — the lived symptom of cursor non-persistence. Directly addressed by chunk 3. **Not theorized — observed this session.**
3. **`tattler_receive` bounce judgment** — per-turn "bounce now or finish?" inference; cleaner queuing semantics would make it structural. Adjacent to the slice.

Huginn's seam categories (detail to follow): pending-clear _timing_, what survived aborts, drain _ordering_ quirks. These feed chunk 3's cursor/clear-durability design specifically.

## Disk-usage napkin math (three independent measurements, 2026-05-26)

Piper, Huginn, and Muninn each measured real session/room JSONL independently and converged:

| Source                         | Per message                                | 10k-message room            |
| ------------------------------ | ------------------------------------------ | --------------------------- |
| Piper (280 real room posts)    | text ~753 B / full entry ~2.7 KB           | ~10 MB compact / ~27 MB fat |
| Huginn (3 sessions)            | ~1.5 KB/line                               | ~15 MB JSONL                |
| Muninn (39 this-session posts) | body ~667 B / record ~1.2 KB / lean ~700 B | ~7–11 MB                    |

**Convergent finding: disk is a non-constraint.** Compact JSONL is ~7–15 MB per 10k messages; SQLite ~3–15 MB; even 1M messages is sub-GB. No backend is disqualified on bytes — the criterion is a wash.

**The real constraint is context budget, not disk** (Muninn's reframe, amplified by Huginn): 10k messages × ~667 B ≈ 6.7 MB of text — 3–4× a 200k-token window. A full room log can never be loaded into one context. So cursor-based reads exist for _selective replay_ / context-budget reasons, not storage efficiency. This sharpens OQ#1: pick the backend that makes **partial, indexed, cursor-bounded reads** cheap and correct — which points at **SQLite (indexed reads + atomic sequence allocation, still inspectable via the sqlite CLI)**, with JSONL+sidecar-index as the grep-native fallback. Naive JSONL-scan is the one option the measurement argues against.

## Sizing verdict

- **Architecturally de-risked**, design-wise. North star is accepted; the primitive is well-understood; the record shape is sketched.
- **~6 implementable chunks, ~5 load-bearing open questions.** The single gating decision is **storage backend** — resolve that and the schema, and the slice unblocks.
- **Honest effort:** not a weekend, not a quarter. A focused multi-session sprint for the targeted slice, with chunks 1–4 (the bug-killing core) landable before the full nudge-demotion + fallback rewire.
- **The fork dissolves:** the narrow durable-room-log+cursor slice _is_ the patch done at the root. Patching the cursor in the current pending-batch architecture would be duct tape we'd rip out; this slice is the same effort pointed at the architecture we're already committed to.

## Recommendation

1. Do **not** band-aid the cursor in the pending-batch path. Build the targeted slice.
2. **First action is a decision, not code:** resolve the storage-backend OQ + record schema. The napkin math (above) effectively answers the backend on technical grounds — **SQLite**, chosen for cursor-bounded selective-replay reads and atomic sequence allocation, not for disk. **Ratified by Doug (2026-05-26):** "disk space is a nothing-burger; the random-access benefits of a DB are a huge win." SQLite is the same-host embedded fit for this append + point/cursor-read pattern. **Confirmed explicitly as SQLite by Doug (2026-05-26) after diligence on stream/LSM alternatives** — daemons ruled out as single-host overkill, RocksDB dropped (LSM solves throughput we lack), Redb pruned on inspectability, DuckDB's columnar model wrong for append + random access. That gate is now cleared; chunks 1–4 unblock.
3. Reuse TAT-39 / TAT-50 audience-snapshot work for chunk 2 rather than rebuilding.
4. File the re-delivery bug regardless (documents the symptom; closes when chunk 3 lands).
5. Keep Broadcast MVP (TAT-10) as the later superset; do not let its scope inflate this slice.

## Spec-review findings & strawman amendments (2026-05-26)

Review pass before ticket breakdown; findings funnel to the breakdown via Piper (scribe/author).

### IA/semantics lens (Muninn) — all accepted

1. **C1 record schema — explicit field selection, not "bootstrap as-is."** Strip ephemeral fields from the current Chorus JSON (broker socket paths, batch-wrapper metadata, `self` flag); keep `postId`, `roomId`, `from`, body, `timestamp`, then add spec-required fields. The schema task is "select stable fields + add required," not a research question.
2. **C1 author provenance — store `agentId`, not handle name.** Current JSON stores the sender as a handle string ("Huginn", "doug"); handle renames would corrupt historical authorship. The durable record stores `agentId` (stable) as the author key and snapshots the handle at post time for display. Connects to the KC5/KC6 identity model.
3. **C2 renamed → "Audience snapshot at append."** `postId` already exists in current JSON, so "stable post IDs" is effectively done; the real new work is snapshotting room participants at append time (TAT-39/TAT-50). Rename prevents underestimating C2.
4. **C4 — define a "replay envelope" distinct from the live DM format.** KC5's "keep live DM tiny" applies to _live_ delivery; `read-from-cursor` is historical replay and should carry timestamps + author handles for temporal context. The replay envelope is undesigned — added to C4 scope.

No chunk-ordering changes; dependencies hold as drawn.

### Engineering/seam lens (Huginn) — accepted as design notes; one fork for Doug

Implementation hazards (not architecture gaps); no chunk reordering. Each attaches as a design note / acceptance criterion on its chunk.

1. **C3 — cursor-advance boundary scope.** Per-agent-_turn_ success or per-Chorus-_tool-call_? Silent agents read but may not call tools. _Recommended:_ advance on agent-turn completion (last-delivered → cursor), not a specific tool call, so silent/non-tool turns still advance correctly. Confirm during C3.
2. **C1 — room identity durability.** roomId rename/merge would orphan history. _Recommended:_ same pattern as the agentId decision — stable room **UUID** as the durable key + snapshot `roomName` at post time. (Consistency with IA finding #2.)
3. **C4/C5 — auto-inject vs explicit-tool read. [FORK — needs Doug]** Is unread history auto-delivered at turn start (as pending-batch does today) or must the agent call a tool? Explicit-only would be a breaking UX change. _Recommended hybrid:_ auto-deliver unread-since-cursor at turn start (preserves today's UX, fixes the bug) **and** expose an explicit `read-from-cursor` tool for deeper on-demand replay beyond the auto window. The one consequential fork in this review.
4. **C6 — fallback/cutover authority.** Dual-write, or single-write-new + read-old fallback? Which path is authoritative? _Recommended:_ durable log authoritative once live; during migration the log is truth and pending-batch is read-only fallback for pre-cutover messages (avoid dual-write drift). Explicit cutover design before coding.
5. **C3 — legacy cursor initialization.** Agents predating the cursor table: replay-all or start-at-head? _Recommended:_ initialize at current **head**, not beginning — replaying full history as unread would dump the whole log into context, the opposite of the goal.

## Source artifacts

- `mailbox-coordination-architecture-notes.md` — KC4 (964–1095), KC5 (1096–1276), Cross-Cutting (1379), MVP slices (1434, 1509), Decision Log (1532).
- AGENT-201 (arch review, COMPLETE), TAT-10 (Broadcast MVP, NOT STARTED/LOW), TAT-39/TAT-50 (audience snapshot, in flight), TAT-36/37/58 (queue-recovery cluster).
- Piper `memory/projects.md` (durable-log next shelf, 2026-05-26), `memory/patterns.md` (Log as truth, inbox as projection).
- TAT-70 (parent), TAT-71–76 (Track 1 chunks), TAT-77 (Track 2 TUI), TAT-78 (Track 3 Chorus refactor).

---

## Session decisions — 2026-05-27

Decisions from the room "tattler durable chats refactor" session (Doug, Huginn, Muninn, Piper). These refine and supersede earlier framing where noted.

### Tattler-layer scope

The durability primitive lives at the **Tattler layer**, not the Chorus layer. Tattler owns the pipe and the persistence of that pipe. Chorus consumes the durable substrate for coordination semantics (broker, fanout, audience). This prevents dependency inversion where the group-messaging layer owns the primitive the transport needs.

Three-track structure:

- **Track 1 (serial, C1–C6):** Tattler protocol layer. TAT-71 through TAT-76.
- **Track 2 (parallel-ready once C1 schema frozen):** Standalone read-only TUI. TAT-77. Not coupled to Pi harness. Read-only MVP (send via CLI). TUI hydration contract in-scope.
- **Track 3 (serial, post-Track 1):** Chorus refactor as consumer of Tattler primitives. TAT-78. Broker-less, session-decoupled.

### SQLite driver: better-sqlite3

`better-sqlite3` for runtime-agnostic distribution, not `bun:sqlite`. Reason: `bun:sqlite` is a Bun runtime API that cannot be bundled for Node (`ERR_UNSUPPORTED_ESM_URL_SCHEME` on `bun:` protocol). Compiled Bun binaries are too large (~80-100MB). `better-sqlite3` works under both Bun and Node runtimes. Three independent tests confirmed the incompatibility.

### Migration strategy: simple/manual

`_migrations` table + ordered SQL files. No migration library. Simple, inspectable, zero deps beyond `better-sqlite3`.

### Agent identity: Tattler ID for MVP

`agentId` uses the existing Tattler ID convention for MVP. No identity-layer work (birdup UUID) required before schema definition. birdup already soft-enforces persistent identity. Schema is UUID-compatible (same column type, same FK relationship) for directory rollout later.

**Note:** Ephemeral agents _do_ need durability (they can be `--resume`'d across days), but their Tattler ID is session-scoped, so they cannot safely use the shared SQLite cursor table. See "Ephemeral vs persistent agent cursor storage" below.

### Cursor advance: batch-atomic on tool-call success

Per-message advance was considered (Huginn proposed) and rejected (Piper + Muninn pushed back). Per-message fixes over-delivery but creates under-delivery on partial failure — delivered-but-not-processed messages would be skipped on re-delivery, which is TAT-37 territory (message loss). Batch-atomic advance on tool-call success is the invariant: delivered-but-uncommitted messages re-deliver on resume (correct); committed messages never re-deliver (kills TAT-68).

### read-from-cursor: explicit-fork MVP

No auto-deliver at turn start for MVP. Agent calls `read-from-cursor` when ready. Makes state reasoning simple, observable, debuggable. Matches standalone TUI interaction model (show N unread, agent reads on demand). Auto-deliver can be added later as opt-in without breaking the explicit path. Huginn's C4 auto-deliver-vs-explicit fork resolved in favor of explicit for MVP.

### Cursor table colocation: stays with the room log

The `cursors` table lives in the same SQLite database as `messages`, permanently. It is delivery state for a specific log's `seq` coordinate system, not profile state for an agent.

Rationale (Muninn, 2026-05-27, accepted by Huginn):

- A cursor is keyed by `(agent_id, room_id, last_seq)` — it references a specific log's sequence numbers. Moving it to an Agent Directory would force that directory to understand every log namespace and sequence semantics it stores, creating the exact cross-store seam we're avoiding.
- The Agent Directory should own identity mapping (Tattler ID → canonical ID), not delivery position. "Any table with `agent_id` goes in the directory" is how identity services become persistence swamps.
- Global inbox view is a derived query across room logs, not a separate table.
- Schema is already forward-compatible: `agent_id TEXT` is just a foreign-key-shaped column. When an Agent Directory exists, resolution happens at read time (or via a mapping table), but the cursor row never moves.

### Ephemeral vs persistent agent cursor storage

Not all agents share the same cursor store. The split is by identity stability, not by agent type. For a given subject kind, pick **one** store — no dual cursor authority.

**Persistent agents** (birdup-managed identity, `~/.sandpiper/agent/identities/`): SQLite cursor table. Their Tattler ID is stable across sessions, so `(agent_id, room_id)` is a correct unique key. Cursor survives `--resume` by construction.

**Guest/ephemeral agents** (session-scoped identity, no `~/.sandpiper/agent/identities/` entry): Pi session entries (`appendEntry`), not the SQLite cursor table. Their Tattler ID is session-scoped — two different ephemeral agents named "Scout" in different sessions would collide on `(Scout, room_id)` in SQLite, causing silent replay gaps. Session entries are per-session by construction, so no collision. Guest cursor state dies with the resumable session; no orphan rows accumulate in the shared room-log DB.

**No "session cache with DB fallback" for advancement.** Do not use `appendEntry` as a hot cache for persistent agents with SQLite fallback unless there is an explicit reconciliation rule. Dual authority for the same subject kind creates consistency questions we don't need.

The `readMessagesSinceCursor()` API abstracts over both stores so the caller does not care which backs it, but the store is chosen by subject kind, not by runtime optimization.

This is a TAT-73 design note, not a TAT-71 change. TAT-71 provides the SQLite primitive; TAT-73 wires the multi-store abstraction into the Tattler inbox.

### Cursor subject naming

The physical TAT-71 column is `agent_id`, fine for MVP, but the abstraction should be a `CursorSubject` / `deliverySubject`, not "agent id" smeared across guest session, persistent Tattler identity, and future directory UUIDs.

Suggested subject kinds for TAT-73:

- `persistent-tattler` — birdup-managed agents, SQLite cursor table
- `guest-session` — ephemeral agents, Pi session entries
- `directory-agent` — future Agent Directory agents, deferred

The important bit is store routing by subject kind. Guests never write SQLite cursor rows, so the SQLite `cursors` table only holds `persistent-tattler` subjects today.

### Open questions for TAT-73 / TAT-74

**OQ1 — Guest branch semantics.** ✅ **RESOLVED — guest cursors are NOT branch-local.** (Doug, 2026-05-27)

Guest cursor state is global to the resumable session, not tied to the current branch. Branch rewinds do not rewind delivery position. If the user wants the agent to "forget" what it read on a rewound branch, they opt into branch summarization at the fork point — that's the Pi session mechanism, not the cursor table's job. Restoring from `getBranch()` would cause the agent to re-read potentially thousands of messages after a long-lived branch rewind, which is the opposite of the desired behavior.

**OQ2 — Guest cursor entry schema.** Choose the snapshot shape for `appendEntry`. Strawman: `customType: 'tattler.room-cursors.v1'` with `{ version, cursors: [{ roomId, lastSeq, updatedAt }] }`. Snapshot, not per-message event log.

**OQ3 — Author identity in replay envelope.** The same namespace ambiguity can hit `messages.agent_id` for authors. TAT-71 can stand, but TAT-72/TAT-74 should make replay author provenance typed enough that a guest UUID and a persistent handle-shaped ID don't become semantic soup.
