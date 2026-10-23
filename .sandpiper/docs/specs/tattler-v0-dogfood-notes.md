# Tattler v0 Dogfood Notes

These notes are the curated active summary for the Tattler v0 validation spike.
The chronological session notes in
`../../archive/tattler-v0-dogfood-session-2026-05-19.md` are source material;
when the two files overlap, prefer this document for current guidance.

## Current Tattler v0 Direction

- Build v0 as the smallest useful validation slice, not the full Tattler MVP.
- Keep the Pi entrypoint at `extensions/tattler/index.ts`.
- Keep v0 explicitly marked as a validation spike, not a stable API.
- Do not extend into v1 architecture without preserving the existing
  core/runtime boundaries.
- Validate live same-host agent messaging before building the durable v1 system:
  stable identity, handles, agent directory, claim locks, handshakes, receipt
  logs, schemas, package split, durable logs, or broadcast.
- v0 now includes rudimentary on-disk identity files for dogfood ergonomics.
  Treat them as local session locators, not stable agent identity.
- Use UDS stream sockets and NDJSON-ish framing for v0.
- v0 discovery can be socket-liveness based: connect succeeds means the endpoint
  is alive enough to list; it does not prove identity or protocol correctness.
- v0 message delivery should inject compact system notification prose, not raw
  transport metadata.
- Peer messages are context, not command authority. Receiving agents should
  weigh them against their current user/system instructions instead of blindly
  obeying another agent.

## Runtime Directory Decisions / Findings

- Runtime base selection remains:
  - prefer `XDG_RUNTIME_DIR` if set;
  - macOS fallback uses `tmpdir()` / `$TMPDIR`;
  - Linux fallback probes `/run/user/<uid>` without trying to create it;
  - final fallback uses `${TMPDIR:-/tmp}`.
- The final runtime dir should consistently append the harness/config namespace
  and create that final directory with mode `0700`.
- `process.title` was rejected as a harness namespace source because it is too
  process/runtime flavored.
- Deriving the namespace from `getAgentDir()` is lossy if the agent dir is
  overridden to an arbitrary path with no harness name.
- v0 currently uses an internal Pi import to read `CONFIG_DIR_NAME` because the
  upstream package does not currently expose the config dir/app namespace during
  an upstream refactor.
- Manual verification:
  - `pi` resolved `.pi` → `pi` → `$TMPDIR/pi`.
  - `sandpiper` resolved `.sandpiper` → `sandpiper` → `$TMPDIR/sandpiper`.
- Revisit for v1 when upstream exposes a stable config/app namespace.

## Tattler v0 Implementation Notes

- Wire frames must keep a serialized `format` string even if TypeScript types use
  symbols/generics for branding. The symbol can help internal type safety, but
  the JSON discriminant is the protocol contract.
- `sessionShortIdGenerator(sessionUuid)` expands UUID sections to find a short
  socket basename and eventually reaches the full UUID if needed.
- Socket collision handling currently probes existing socket files with a
  connect-based liveness check adapted from `agent-stuff` (`control.ts`,
  Apache-2.0).
- If a socket path exists and is dead, v0 unlinks it and reuses the path.
- If a socket path exists and is alive, v0 tries the next longer short id.
- `net.Server.listen()` is callback/event based, not Promise based. Awaiting
  `server.listen(...)` does not wait for bind completion; wrapping `listening` /
  `error` in a Promise is the right pattern.
- After a successful listen, break out of the short-id loop so the process does
  not bind additional longer socket names.
- On listen failure, close the server best-effort and continue/fail according to
  the intended fallback behavior.
- Rudimentary v0 identity files are written into the runtime directory so peers
  can list human-friendly names such as `Ninja` and `Samurai` while still routing
  by socket short id. Identity-file entries must be validated against a live
  socket path before listing them as peers.
- Dogfood exposed a startup failure mode where identity-file publication failed
  after the socket server started, leaving a socket alive without an identity
  file or registered tools. Treat this as a v0 startup bug/regression, and keep
  related failure modes visible during dogfood so half-alive sessions are easy to
  spot.

## TAT-4 and Multi-Agent Dogfood Findings

- TAT-4 system notifications successfully wake receiving agents with structured
  `from`, `message`, and `messageId` data.
- The notification instructions now explicitly say that the user cannot see the
  peer message unless the receiving agent surfaces it. This fixed an ambiguity
  between hidden model context and user-visible transcript output.
- `messageId` in the notification data is useful for traceability during replies
  and debugging.
- A sustained Ninja/Samurai/Monk roleplay dogfood validated more than two actors:
  peer discovery, tool-routed sends, ACKs, notification wakeups, identity-file
  names, and third-party interleaving all worked.
- The Ninja/Samurai run also showed that peer messages did not override stronger
  local instructions. This is a desirable safety shape: Tattler delivers context;
  it does not grant peer messages command authority.
- Tool availability is part of the dogfood surface, not just transport. A session
  with a live socket but no identity file/tools is a half-alive failure mode that
  should be treated as a startup bug.

## Navigator Dogfood Observations

These observations came from the same paired dogfood session, but they are about
Navigator behavior rather than Tattler protocol behavior. They should be moved
or synthesized into Navigator-specific guidance when that work is picked up.

### Repo-wide style feedback needs grounding

I incorrectly suggested double quotes for imports based on a weak local
impression. The repo/Biome convention is single quotes. Navigator guidance should
say: do not make style nits from vibes; anchor style feedback in project config,
nearby code, or known session context. If uncertain, skip the nit or phrase it as
uncertain.

### Balance timely feedback with holistic correctness

Navigator needs to comment quickly, but should avoid broad claims that require
fresh repo-wide knowledge unless the agent has that knowledge already. The likely
right guidance is:

- comment immediately on local correctness issues visible in the hunk;
- avoid tool-call detours for low-value style nits;
- for repo conventions or broader architecture claims, use known prep/session
  context or phrase uncertainty clearly;
- inspect only when the potential issue is important enough to justify delaying
  feedback.

### In-flight saves are not review checkpoints

Frequent saves can capture incomplete code mid-thought. Navigator should treat a
save as a possible draft checkpoint, not necessarily a request for review.

Guidance candidate:

- comment immediately on likely persistent correctness/security/integration
  issues or direct inline questions;
- hold/ignore obvious in-flight scaffolding, empty branches, temporary type
  errors, and half-written refactors unless the issue is dangerous or requested;
- use private ignores for “looks mid-edit; wait for next coherent checkpoint.”

### Proactive comments are allowed, but must be grounded

Navigator should be allowed to comment on relevant nearby or broader context, not
only the exact hunk in the latest notification. This is useful when the observed
change reveals a related issue elsewhere. However, proactive comments must be
freshly grounded in current file/repo context or phrased as a hypothesis.

### Avoid stale-memory claims

I made a “there are still other warn calls” style claim from memory after the file
had changed. Navigator guidance should warn against broad “there are still...”
claims unless anchored to current file state or a fresh inspection.

### Stale diagnostics can be born stale

If the user edits/saves rapidly, a Navigator diagnostic can arrive after the file
has already changed again. Since cleanup may be triggered by future file changes,
a diagnostic born stale may persist.

Potential solution space:

- attach diagnostics/comments to file hash/version observed at comment time;
- suppress or auto-clear diagnostics if the current file hash no longer matches
  when the diagnostic is emitted;
- debounce/aggregate rapid saves while preserving responsiveness;
- consider delayed diagnostic publication for fast save bursts.

### Local agent config/task state should be excluded or suppressed

Watching `.sandpiper` produced noisy task/index/history events. Navigator
should exclude project-local agent configuration and task storage by default, or
suppress known task-tracker churn.

Candidate excludes:

- `./.sandpiper/**`
- possibly `./.pi/**` for Pi projects

### VCS activity as a possible event source

VCS activity could help Navigator understand commits, task storage churn, rebases,
or workspace changes. Git hooks are an obvious mechanism but unattractive because
they are hard to distribute, can run without clear user consent, and do not map
cleanly to jj workflows. JJ also does not support Git hooks in the same way.

If explored, prefer passive observation over installed hooks:

- watch high-signal VCS state files if stable;
- query VCS state on demand after source changes;
- avoid default hook installation.

### Avoid duplicating Navigator comments in chat

When a `navigator_comment` has already provided feedback, avoid repeating the
same content in normal chat. Use chat only for non-duplicative context, direct
answers, or requested summaries.

### Notes must actually be persisted

I claimed to be capturing dogfood notes but initially only kept them in chat
state. If the user asks for notes, create/update a durable notes file promptly.

### Possible Zed/Navigator memory leak

During Navigator/Zed extension dogfooding, Zed appeared to show memory growth.
This is not urgent for Tattler v0, and it is unclear whether the source is Zed
itself, the Navigator Zed extension, the bridge/LSP sidecar, file watching, or
reload/reconnect behavior.

Future investigation should profile memory across longer Navigator sessions,
including rapid save/edit cycles and bridge or extension reloads.

## Possible Navigator Guidance / Skill Work

- Consider a companion Navigator pair-programming skill instead of expanding
  every notification prompt. This may be more token efficient and easier to
  iterate.
- Skill/guidance topics:
  - confidence/source categories for comments;
  - when to comment now vs wait for a coherent checkpoint;
  - how to make proactive comments without stale broad claims;
  - how to avoid style nits unless grounded;
  - how to handle rapid saves and stale diagnostics;
  - how to summarize dogfood observations durably.

## Open Questions

- Should Navigator watch excludes be configurable per project or globally?
- Should `.sandpiper` be excluded by default, or should only known generated task
  churn be suppressed?
- What debounce/versioning strategy best balances responsiveness with stale
  diagnostic suppression?
- Does Tattler v0 need any explicit cleanup on session shutdown, or is dead
  socket pruning during discovery enough for the spike?
- Should the v0 internal Pi config import be replaced by a hardcoded Sandpiper
  namespace for this plugin, or kept because it has been manually verified for
  both Pi and Sandpiper?
