# Agent Conversation Coordination Architecture Review Notes

> Archived 2026-11-17 as the record of the AGENT-201 review, which is complete. Its decisions are input to the Tattler v1 tasks (TAT-6 to TAT-10). For current Tattler guidance, read [Tattler v0 dogfood notes](../docs/specs/tattler-v0-dogfood-notes.md).

- **Diátaxis mode**: Explanation / working design notes
- **Status**: Complete. The AGENT-201 review is finished.
- **Task**: AGENT-201
- **Last updated**: 2026-05-14

These notes capture the architectural review of brokerless, agent-facing
conversation coordination for Sandpiper. They intentionally treat older mailbox
documents as historical input, not current truth. The old notification subsystem
PRD is explicitly rejected as an architecture input for this work.

## Source Inputs

### Historical docs under review

- `~/Downloads/notification-mailbox-work-plan.md`
- `~/Downloads/mailbox-system-prd.md`

### Explicitly excluded historical doc

- `~/Downloads/notification-system-prd.md`
  - Excluded by decision on 2026-05-14.
  - Sandpiper notifications are based on the existing system notification XML
    envelope and Pi `sendMessage` queue/delivery semantics, not this PRD's custom
    queue/dispatcher/handling-turn/context-rewriter design.

### Current implementation evidence checked so far

- `packages/core/src/system-notification.ts`
  - Sandpiper currently has a lightweight system notification helper built on Pi
    custom messages.
  - Notification content is wrapped in `<sandpiper_system_notification ...>`.
  - Source types are currently `tool`, `harness`, and `peer`.
  - Delivery modes map to Pi message delivery: `steer` and `nextTurn`.
- `packages/core/src/system-prompt.ts`
  - The Sandpiper system prompt explicitly describes the system notification
    XML envelope and tells the model to treat notification instructions as
    scoped to the notification.
- Pi extension/session APIs from installed Pi docs and type definitions
  - `pi.sendMessage(message, options)` supports custom messages that enter LLM
    context.
  - Delivery options include `deliverAs: "steer" | "followUp" | "nextTurn"`
    and optional `triggerTurn: true`.
  - `pi.appendEntry(customType, data)` persists extension state but does not
    enter LLM context.
  - Relevant lifecycle hooks include `session_start`, `session_shutdown`,
    `context`, `input`, `turn_start`, `turn_end`, `message_start`,
    `message_update`, and `message_end`.
- `extensions/system/background-process-hooks.ts`
  - Background process completion currently uses a `context` hook to inject a
    user-style context message rather than the newer system notification helper.
- `extensions/web-fetch/src/index.ts`
  - Web Fetch already uses `sendSystemNotification`, proving the lightweight
    notification path is active code rather than only a design sketch.
- `.sandpiper/docs/specs/concurrent-sessions.md`
  - At the time of this review, session liveness state used flat PID files at
    `$XDG_STATE_HOME/sandpiper/sessions/<sessionId>.pid`. Sandpiper no longer
    writes them.
  - This differs from the older mailbox PRD's implied per-session state layout.

## Review Plan

We will review the seven proposed architecture changes one by one. For each
change, capture:

1. The claim or recommendation.
2. Current codebase evidence.
3. Problem fit: what need it does or does not satisfy.
4. Prior art evidence, once available.
5. Tradeoffs and failure modes.
6. Decision status: accept, reject, revise, or defer.
7. Follow-up tasks/spec changes.

The goal is not to rubber-stamp the initial seven points. They are hypotheses to
stress-test against current Sandpiper/Pi reality and external prior art.

## Prior Art Intake Template

Use this format when reviewing external projects:

```markdown
### <Project name>

- **Link / source**:
- **Framework / dependency relationship to Pi**:
- **Coordination model**: mailbox, pub/sub, shared files, sockets, task board,
  direct process IPC, other
- **Agent identity model**:
- **Discovery / presence model**:
- **Message persistence / replay model**:
- **Delivery semantics**: notify-only, context injection, auto-triggered turn,
  human-mediated, other
- **Loop / noise / cost controls**:
- **Security / trust boundary**:
- **What to borrow**:
- **What to avoid**:
- **Questions raised for Sandpiper**:
```

## Prior Art Scan — Round 1

Public repositories were shallow-cloned under:

```text
/tmp/sandpiper-mailbox-prior-art/repos/
```

Claude Agent Teams public docs were fetched into:

```text
/tmp/claude-agent-teams.txt
```

The local `~/git/claude-code` leak mentioned during discussion has **not** been
inspected. Prefer public docs and public Pi repositories unless we explicitly
need to answer a question that the public material cannot answer.

### Pi subagent example

- **Link / source**:
  `/tmp/sandpiper-mailbox-prior-art/repos/pi/packages/coding-agent/examples/extensions/subagent`
- **Framework / dependency relationship to Pi**:
  Official Pi example extension.
- **Coordination model**:
  Parent-child delegation. The parent invokes a `subagent` tool, which spawns
  separate `pi` subprocesses in JSON mode. Supports single, parallel, and chain
  execution.
- **Agent identity model**:
  Static agent definitions loaded from markdown files. Agent identity is role
  name plus source (`user` or `project`), not a live session identity.
- **Discovery / presence model**:
  Discovers agent definition files from `~/.pi/agent/agents` and optionally
  `.pi/agents`. There is no live peer discovery or mailbox presence.
- **Message persistence / replay model**:
  No mailbox. The parent captures child JSON-mode messages and returns final
  output plus details in the tool result.
- **Delivery semantics**:
  Synchronous from the parent perspective: the tool call waits for child process
  completion. Streaming is presented through tool `onUpdate`, not durable mail.
- **Loop / noise / cost controls**:
  Max 8 parallel tasks, max 4 concurrent. Agent definitions can restrict tools
  and model. Project-local agents require explicit confirmation by default.
- **Security / trust boundary**:
  Strong note that project-local agents are repo-controlled prompts; default is
  user-scope only unless `agentScope` includes project agents.
- **What to borrow**:
  - Agent definition discovery and frontmatter shape.
  - Project-local prompt trust warning and explicit confirmation model.
  - Details payload structure with messages, usage, model, and source.
  - Tool rendering patterns for collapsed/expanded child results.
- **What to avoid**:
  - Treating parent-child subprocess delegation as equivalent to peer mailbox
    coordination.
  - Blocking parent interaction while child runs, if our goal is live
    multi-session coordination.
- **Questions raised for Sandpiper**:
  - Should mailbox descriptors reuse existing Sandpiper/Pi agent definitions for
    advertised capabilities?
  - Should project-local mailbox roles be considered trusted only after user
    approval, like project-local agents?

### `agent-stuff` session control extension

- **Link / source**:
  `/tmp/sandpiper-mailbox-prior-art/repos/agent-stuff/extensions/control.ts`
- **Framework / dependency relationship to Pi**:
  User extension for Pi session-to-session control.
- **Coordination model**:
  Direct live session RPC over Unix domain sockets. Each enabled Pi session
  exposes a control socket at `~/.pi/session-control/<session-id>.sock`.
- **Agent identity model**:
  Session ID is primary identity. Session name can become an alias via symlink.
  `PI_SESSION_ID` is exported into the process environment.
- **Discovery / presence model**:
  `list_sessions` scans socket files, pings each socket, resolves aliases, and
  returns live sessions. Dead sockets are ignored; stale alias cleanup is noted
  as TODO.
- **Message persistence / replay model**:
  No durable mailbox. Only running sessions with reachable sockets can receive
  messages.
- **Delivery semantics**:
  RPC `send` injects a displayed custom message (`session-message`) into the
  target with `triggerTurn: true`. If target is idle, delivery is direct; if
  busy, it uses `deliverAs: steer` or `deliverAs: followUp`.
- **RPC surface**:
  `send`, `get_message`, `get_summary`, `clear`, `abort`, and `subscribe`
  (`turn_end`). Startup flags support one-shot send and optional waiting for
  `turn_end`.
- **Envelope / frame design**:
  Sender metadata is appended in a `<sender_info>{json}</sender_info>` envelope.
  The message renderer strips the envelope for display and shows sender info in
  the label.
- **Loop / noise / cost controls**:
  Mostly caller discipline. Startup sends default to no `sender_info` to avoid
  reply attempts to short-lived sender sessions. There is no durable policy
  layer.
- **Security / trust boundary**:
  Validates session IDs and aliases against path traversal. Unix sockets imply
  same-user local IPC, but this is not cross-platform.
- **What to borrow**:
  - Live-session discovery via reachable control endpoints.
  - Explicit current-session env var for scripts.
  - Alias-by-session-name, but only as a convenience, not canonical identity.
  - Simple newline-delimited JSON RPC framing.
  - `sender_info` as a compact envelope precedent.
  - `turn_end` subscription for request/response workflows.
- **What to avoid**:
  - Live socket reachability as the only mailbox model.
  - Auto-triggering recipient turns as the default behavior.
  - Session ID as the only meaningful identity for coordination.
  - Unix-socket-only design if Sandpiper wants broader platform support.
- **Questions raised for Sandpiper**:
  - Should mailbox v1 include a direct live-control path in addition to durable
    inbox files?
  - Should `send` be split into durable mail and live steering tools, rather
    than one tool doing both?

### `pi-interactive-subagents`

- **Link / source**:
  `/tmp/sandpiper-mailbox-prior-art/repos/pi-interactive-subagents`
- **Framework / dependency relationship to Pi**:
  Pi extension focused on async parent-child subagents in terminal multiplexer
  panes.
- **Coordination model**:
  Parent spawns subagents into tmux/Zellij/cmux/WezTerm panes. The `subagent`
  tool is explicitly fire-and-forget: it returns immediately, and a watcher later
  injects the result into the parent.
- **Agent identity model**:
  Running child ID, display name, agent role, session file, launch script, and
  optional activity file. Child context is marked with environment variables such
  as `PI_SUBAGENT_SESSION`, `PI_SUBAGENT_NAME`, and
  `PI_SUBAGENT_ACTIVITY_FILE`.
- **Discovery / presence model**:
  Running subagents live in parent process memory and are rendered in a parent
  widget. Child liveness/progress comes from a child-written activity snapshot,
  not from terminal scrollback or session-file growth.
- **Message persistence / replay model**:
  Child session files are deterministic and resumable. Result/ping delivery is
  a parent injected custom message; there is no general peer mailbox.
- **Delivery semantics**:
  Completion, failure, and help requests are delivered to the parent with
  `pi.sendMessage(..., { triggerTurn: true, deliverAs: "steer" })`. Subagents can
  call `caller_ping` to exit and request parent help; parent can resume the child
  session with guidance.
- **Loop / noise / cost controls**:
  Distinguishes interactive and autonomous subagents. Interactive user-driven
  subagents intentionally do **not** wake the parent on stalled/recovered status
  transitions; only the widget changes. This is a useful distinction between
  human-visible state and model-turn-triggering notifications.
- **Status model**:
  Child activity snapshot records phase (`starting`, `active`, `waiting`,
  `done`), active scope (`agent`, `turn`, `provider`, `streaming`, `tool`), tool
  names, sequence, and timestamps. Parent classifies this into `starting`,
  `active`, `waiting`, `stalled`, or `running`.
- **What to borrow**:
  - Fire-and-forget tool semantics with clear instruction not to poll.
  - Separate status widget updates from LLM wake-up messages.
  - Activity snapshot file as a reliable low-cost status channel.
  - `interactive` versus autonomous notification policy.
  - `caller_ping` as a child-to-parent help request pattern.
  - Resumable session-file handoff.
- **What to avoid**:
  - Treating parent-owned in-memory watcher state as sufficient for general
    cross-session coordination.
  - Assuming a parent-child topology when our mailbox may involve sibling or
    independent sessions.
- **Questions raised for Sandpiper**:
  - Should mailbox recipients have notification policy modes like
    `interactive`, `autonomous`, or `manual`?
  - Should liveness be based on explicit activity snapshots rather than only PID
    files?

### Claude Agent Teams public docs

- **Link / source**:
  `https://code.claude.com/docs/en/agent-teams`, fetched as
  `/tmp/claude-agent-teams.txt`.
- **Coordination model**:
  Team lead plus independent teammates. Shared task list and mailbox are the
  core coordination primitives. Teammates can message one another directly; lead
  synthesizes results.
- **Agent identity model**:
  Lead assigns teammate names at spawn time. Team config contains members with
  name, agent ID, and agent type. Teammates can read this file to discover other
  members.
- **Discovery / presence model**:
  Team config under `~/.claude/teams/{team-name}/config.json`. The docs warn
  this is generated runtime state and should not be preauthored or hand-edited.
- **Message persistence / replay model**:
  Public docs describe a mailbox but do not expose all implementation details.
  Task list storage is local under `~/.claude/tasks/{team-name}/`.
- **Delivery semantics**:
  Teammate messages arrive at the lead automatically. Idle notifications arrive
  automatically. Users can also talk directly to teammates via in-process
  navigation or split panes.
- **Task semantics**:
  Tasks have pending, in-progress, and completed states. Tasks can depend on
  other tasks. Teammates can self-claim unassigned, unblocked tasks. Claiming
  uses file locking.
- **Governance semantics**:
  Teammates can be required to produce a plan before mutating files. Lead may
  approve or reject with feedback. Hooks can block task creation/completion or
  keep idle teammates working.
- **Loop / noise / cost controls**:
  Docs strongly emphasize cost/coordination overhead and recommend teams only
  where independent parallel work adds value. They explicitly say Claude will not
  create a team without approval. Limitations include no nested teams and one
  team per lead.
- **Known limitations from public docs**:
  - No session resumption with in-process teammates.
  - Task status can lag and block dependencies.
  - Shutdown can be slow.
  - One team at a time.
  - No nested teams.
  - Lead is fixed for team lifetime.
  - Permission mode is inherited at spawn.
- **What to borrow**:
  - Product framing: shared tasks + mailbox, not a notification framework.
  - Direct human interaction with teammates as first-class UX.
  - Explicit lead/teammate names for routing.
  - Task dependencies and lock-protected claiming as proven coordination
    primitives.
  - Plan approval for risky mutating work.
  - Clear guidance that teams are costly and should be used selectively.
- **What to avoid / treat carefully**:
  - Generated team config as opaque runtime state conflicts with Sandpiper's
    preference for inspectable, VCS-friendly task state where possible.
  - Fixed lead and one-team limits may not fit Sandpiper's multi-session goals.
  - Public docs acknowledge stale/lost teammate state on resume; Sandpiper should
    design this deliberately instead of inheriting it.
- **Questions raised for Sandpiper**:
  - Do we need a formal lead concept, or should mailbox be peer-first with
    optional coordinator roles?
  - Should task state and mailbox state be integrated with the project task tracker rather than a
    new team-specific task store?

### `pi-agent-teams`

- **Link / source**:
  `/tmp/sandpiper-mailbox-prior-art/repos/pi-agent-teams`
- **Framework / dependency relationship to Pi**:
  Pi extension mimicking Claude Agent Teams, with substantial concrete mailbox,
  task, and lifecycle machinery.
- **Coordination model**:
  Leader/worker team. Shared task list, file mailboxes, worker self-claim,
  direct messages, broadcast, graceful shutdown handshake, plan approval, hooks,
  attach/detach, optional git worktrees.
- **Agent identity model**:
  Team config records `teamId`, `taskListId`, `leadName`, and members. Members
  have `name`, `role`, `status`, `lastSeenAt`, optional `sessionFile`, `cwd`, and
  metadata. This is much richer than session ID alone.
- **Discovery / presence model**:
  Team directories under `~/.pi/agent/teams/<teamId>` by default, with
  `PI_TEAMS_ROOT_DIR` override. `team-discovery.ts` lists team configs and attach
  claims. Workers register themselves on `session_start` and update status on
  idle/shutdown.
- **Message persistence / replay model**:
  Per-recipient JSON array inboxes:
  `mailboxes/<namespace>/inboxes/<agent>.json`. Messages are marked read in a
  locked transaction. Namespaces separate team DMs from task-list assignment
  pings.
- **Mailbox message schema**:
  `from`, `text`, `timestamp`, `read`, optional `color`, optional `urgent`.
  Higher-level protocol messages are JSON payloads stored in `text`, with types
  like `task_assignment`, `idle_notification`, `shutdown_request`,
  `plan_approval_request`, and `peer_dm_sent`.
- **Delivery semantics**:
  Workers poll mailboxes every ~350–550 ms with jitter. Normal messages queue
  until idle. Urgent messages interrupt a streaming turn with
  `pi.sendUserMessage(..., { deliverAs: "steer" })`. Leader inbox polling injects
  structured `[Team]` messages into the leader LLM, usually as `followUp`, and
  wakes the leader directly when a tracked batch completes while idle.
- **Loop / noise / cost controls**:
  Has an `urgent` flag, but auto-claim and automatic injections are fairly
  aggressive. Hooks, plan approval, task dependencies, and shutdown handshake add
  governance. Peer-to-peer DMs are CC'd to the leader as `peer_dm_sent`.
- **Concurrency / locking**:
  Lock files use exclusive create, stale lock eviction, exponential backoff, and
  jitter. Task ID allocation and task mutations are locked. Mailbox pop is
  atomic read-and-mark-read.
- **What to borrow**:
  - Descriptor richness: member name, role, status, cwd, session file, metadata.
  - Namespace idea for separating general team messages from task-specific
    assignment/control messages.
  - Urgent-vs-normal distinction as future prior art, though Sandpiper v1 should
    default to steer + triggerTurn instead of adding a policy matrix.
  - Graceful shutdown request/approve/reject protocol.
  - Plan approval request/approve/reject protocol.
  - File locking with stale-lock handling and jitter.
  - Leader attach/discovery concepts if Sandpiper supports session takeover.
- **What to avoid / adapt**:
  - JSON array inboxes rewrite whole files; JSONL or a small database is more
    plausible for append-heavy logs.
  - No stable message IDs or branch/reply metadata.
  - Hard-coded leader/worker product model may be too narrow for peer
    conversations.
  - Fast polling is wasteful for Sandpiper's same-host push delivery model.
  - Automatic self-claim is outside Sandpiper conversation v1.
- **Questions raised for Sandpiper**:
  - Should v1 support message namespaces or typed channels?
  - What measured problem would justify adding `urgent` / `followUp` later?
  - Is any delivery status needed in v1 beyond liveness-scoped scan state?

### `pi-teams`

- **Link / source**:
  `/tmp/sandpiper-mailbox-prior-art/repos/pi-teams`
- **Framework / dependency relationship to Pi**:
  Another Claude-Agent-Teams-inspired Pi extension, broader terminal-adapter
  focus.
- **Coordination model**:
  Lead creates a team, spawns teammates in panes/windows, maintains team config,
  tasks, inboxes, and runtime heartbeat files.
- **Agent identity model**:
  Team config includes lead session ID, members with `agentId`, `name`,
  `agentType`, terminal pane/window IDs, cwd, model, thinking level, prompt,
  and plan-mode flag.
- **Discovery / presence model**:
  State under `~/.pi/teams/<team>` and `~/.pi/tasks/<team>`. Runtime status files
  track PID, heartbeat, readiness, last inbox read, and last error.
- **Message persistence / replay model**:
  JSON array inboxes with `from`, `text`, `timestamp`, `read`, optional summary
  and color. `read_inbox` can mark messages read.
- **Delivery semantics**:
  Teammates and lead poll every 30 seconds when idle. Polling injects a simple
  user message: "I have N new message(s) in my inbox. Reading them now..." The
  model must then call `read_inbox`.
- **Loop / noise / cost controls**:
  Low-frequency idle polling avoids mid-turn interrupts but can add model turns
  merely to discover mail. Runtime health checks identify `healthy`, `idle`,
  `starting`, `stalled`, and `dead` states.
- **Security / trust boundary**:
  Strict `sanitizeName` allows only alphanumeric, hyphen, and underscore for team
  and agent names. Tests cover path traversal attempts.
- **What to borrow**:
  - Runtime heartbeat fields: PID, startedAt, lastHeartbeatAt, lastInboxReadAt,
    ready, lastError.
  - Simple path sanitization rule for user-visible names.
  - Health state vocabulary, especially startup-stalled detection.
- **What to avoid / adapt**:
  - Polling by waking the model just to read inbox seems noisy and token-expensive.
  - Separate task store under `~/.pi/tasks` would duplicate the project task tracker.
  - Message schema is too weak for threaded coordination.
- **Questions raised for Sandpiper**:
  - Can conversation/unread status be surfaced through tools or scoped context
    without waking the model solely to discover mail?
  - Should presence records include both liveness and readiness (`lastInboxReadAt`)?

### `pi-crew`

- **Link / source**:
  `/tmp/sandpiper-mailbox-prior-art/repos/pi-crew`
- **Framework / dependency relationship to Pi**:
  Large Pi extension for durable multi-agent workflow orchestration. It is not a
  direct live mailbox team clone; it is a run/task/artifact orchestration system
  with mailbox foundations.
- **Coordination model**:
  Durable run model: manifest, task graph, event log, per-agent status, artifacts,
  optional async background runner, child Pi workers, experimental live-session
  runtime, worktree isolation.
- **Agent identity model**:
  Run/task/agent records rather than simple live sessions. Agents are tied to
  run IDs and task IDs, with per-agent status and artifacts.
- **Discovery / presence model**:
  Project-local state under `.crew/` by default, or `.pi/teams/` when legacy
  `.pi/` already exists. User-global fallback under Pi agent extension config.
  Heartbeats track worker liveness.
- **Message persistence / replay model**:
  JSONL mailboxes:
  - `{stateRoot}/mailbox/inbox.jsonl`
  - `{stateRoot}/mailbox/outbox.jsonl`
  - `{stateRoot}/mailbox/delivery.json`
  - `{stateRoot}/mailbox/tasks/{taskId}/inbox.jsonl`
  - `{stateRoot}/mailbox/tasks/{taskId}/outbox.jsonl`
- **Mailbox message schema**:
  `id`, `runId`, `direction`, `from`, `to`, `body`, `createdAt`, `status`,
  optional `kind`, `priority`, `deliveryMode`, `taskId`, `data`, `replyTo`,
  `replyFrom`, `replyDeadline`, `repliedAt`, and `replyContent`.
- **Delivery semantics**:
  API exposes `send-message`, `read-mailbox`, `ack-message`, `read-delivery`, and
  `validate-mailbox`. Steering and follow-up helpers create mailbox messages with
  kind `steer` or `follow-up`, priority, and delivery mode (`interrupt` or
  `next_turn`). Replay marks pending inbox messages delivered and records events.
- **Loop / noise / cost controls**:
  Full live mailbox runtime is intentionally deferred. `docs/live-mailbox-runtime.md`
  explicitly says live workers should come only after heartbeat writers,
  claim-safe task lifecycle, mailbox, and locking contracts are stable.
- **Security / trust boundary**:
  Strong safe-path checks, symlink rejection, redact-on-write, schema validation,
  repair mode, and contained file reads. Project config cannot override sensitive
  execution controls.
- **Concurrency / locking**:
  Run-level mutation lock. Task claims have owner/token/lease expiry. Status
  transitions require valid claims. Heartbeat APIs exist.
- **What to borrow**:
  - JSONL mailbox plus separate delivery state rather than rewriting arrays.
  - Stable message IDs and explicit acknowledgement.
  - Message kind, priority, delivery mode, task scoping, and reply metadata.
  - Validate/repair API for mailbox state.
  - Claim leases with tokens for task lifecycle safety.
  - Explicit decision to postpone always-on live mailbox runtime until contracts
    are stable.
- **What to avoid / adapt**:
  - The run-oriented schema may be too heavyweight for session-level mailbox v1.
  - Per-run state root does not directly solve global session discovery.
  - Some docs point to internal/future features; distinguish implemented API from
    roadmap claims before borrowing.
- **Questions raised for Sandpiper**:
  - Should Sandpiper mailbox use JSONL plus delivery sidecar from day one?
  - Should v1 include `kind`, `priority`, `deliveryMode`, and reply fields, even
    if many are optional?
  - Should task claims/leases be part of mailbox v1, or left to the task tracker?

## Prior Art Synthesis

### Strong consensus

- Multi-agent coordination products converge on **shared task state plus durable
  messages/conversations**. Notification-like behavior is delivery/presentation
  of conversation events, not the core abstraction.
- Live delivery and durable conversation state are different concerns. Same-host
  Unix IPC is good for currently running sessions; durable logs provide a paper
  trail, channel history, replay/query, and agent/tool inspection.
- Role/name/session descriptor identity beats raw session ID. Session ID is a
  useful address, but human-meaningful names, cwd, session file, task/focus, and
  status make routing much better.
- Push wake-up is essential for online headless agents. Existing tools use
  `triggerTurn` to avoid polling; the first Sandpiper MVP should do the same for
  ephemeral online DMs. Broadcast MVP should reuse the same primitive later.
- File-backed coordination needs locks/transactions, atomic writes, safe path
  handling, stale endpoint cleanup, and validation. This is not distributed event
  sourcing; it is local Unix IPC with an append-only paper trail.
- Status/presentation should not be conflated with model context. The better
  designs keep activity snapshots cheap and wake the LLM only for important
  events.

### Implications for the seven hypotheses

- **Key Change 1** is reinforced: use Sandpiper's existing notification envelope
  and Pi's built-in message queue/delivery semantics; do not design a separate
  notification subsystem.
- **Key Change 2** is strongly reinforced, but split into phases: the first MVP is
  ephemeral peer messaging; durable conversation/task coordination follows in the
  Broadcast MVP.
- **Key Change 3** is reframed: `triggerTurn` is the default online delivery
  primitive for DMs now and broadcasts later; avoid polling and avoid building a
  wake-policy framework until measured need appears.
- **Key Change 4** is reinforced and narrowed: first-MVP layout is live same-host
  routeability records and UDS/SHM endpoints; durable log layout belongs to the
  Broadcast MVP.
- **Key Change 5** is reinforced with revision: stable IDs, sequence/order,
  author provenance, task/session references, and optional branch/reply metadata
  matter for Broadcast MVP; durable acknowledgement/read state is out of scope
  unless a concrete use case appears.
- **Key Change 6** is reinforced and narrowed: descriptors are online routing
  records, not a general offline address book. They should include endpoint,
  session, cwd/project, task/focus, status, and liveness/readiness hints.
- **Key Change 7** is reinforced: the better designs use normal message injection
  and tool-queryable durable state rather than deep context rewriting as the
  first mechanism.

## Current Working Assumptions

- Conversation coordination is **same-host local IPC** for the first slice. There
  is no network, cross-host delivery, or adversarial distributed-system transport
  model.
- Transport unreliability is not a primary design concern for v1. We assume local
  Unix domain sockets or shared memory are reliable enough; if those fail, the
  process/session is unhealthy rather than a condition to paper over with a
  retry/event-stream framework.
- Expected scale is small: tens of agents are plausible; hundreds would be an
  extreme stress case. Do not design v1 like Kafka, Kubernetes, or distributed
  event sourcing.
- This is Unix IPC with a durable paper trail: append-only conversation logs plus
  live nudges to online sessions.
- The immediate MVP is ephemeral same-host messaging only. Durable conversation
  storage and broadcast are design affordances for the next slice, not part of
  the first MVP.
- When durable conversation storage is added, it should be user-configurable and
  should default to XDG state when unconfigured. Storage location is not the same
  as conversation scope: the broadcast slice should include at least a user-global
  broadcast channel and a cwd-scoped/project broadcast channel.
- The system is purely agent-facing for v1: no standalone human UI/TUI/dashboard.
  Human interaction is mediated through an active agent using the tools. Direct
  human participation as a conversation actor is interesting but explicitly
  deferred beyond v1.
- Human control matters more than autonomous agent chatter.
- Persistent conversation state and ephemeral turn notifications should remain
  separate concepts.
- The design should fit Pi's existing session tree and custom message model
  instead of replacing them.
- Push wake-up for online headless agents is a core use case, not an optional
  luxury. Keep v1 simple: direct messages are ephemeral same-host IPC to online
  agents only. Use author provenance to avoid loopback; send notifications as
  `deliverAs: "steer"` with `triggerTurn: true`. Broadcast/channel delivery,
  durable logs, configurable wake policy, durable ack/read cursors, causal-chain
  budgets, retries, and coalescing are deferred until measured need appears.

## Key Change 1 — Use existing system notifications and Pi message queues

### Initial recommendation

Conversation coordination should use the existing `sendSystemNotification()` XML
envelope plus Pi `sendMessage()` delivery semantics. Do not design or implement a
separate notification queue, dispatcher, handling-turn system, or context
rewriter for conversation work.

### Why this came up

Sandpiper already has the notification primitive needed for conversation event
surfacing, and Pi already has the message queue/delivery machinery. Conversation
work should build on those primitives instead of adding another notification
layer.

### Current codebase evidence

- `sendSystemNotification()` exists in `packages/core/src/system-notification.ts`.
- System notifications are hidden custom messages with a structured XML envelope.
- Pi already distinguishes custom entries that enter context from extension state
  that does not enter context.
- Web Fetch already uses the helper successfully.
- Background process completion predates or bypasses the helper, which suggests
  there is some consolidation opportunity, but not a need for a new notification
  subsystem.

### Discussion notes

Pi already owns message queuing. A Sandpiper extension can call `sendMessage`,
choose `deliverAs`, and optionally request `triggerTurn`; Pi queues and delivers
that message according to its normal agent-loop semantics. Sandpiper does not
need to add a notification queue on top of Pi's message queues.

The only likely Sandpiper core change for conversation notifications is to expose
the Pi `triggerTurn` option through the `sendSystemNotification()` helper. The
existing helper currently wraps the XML envelope and delivery mode; conversation
coordination needs to say "surface this notification and wake this online agent"
for DM and broadcast nudges.

Conversation durability belongs in conversation state, not notification state:
message IDs, sequence/order, author provenance, references, and branch/reply
metadata should be modeled as log data. Notification remains a thin same-host
delivery/presentation adapter for online sessions.

### Benefits if accepted

- Smaller first slice.
- Less risk of fighting Pi's session tree, compaction, and message conversion.
- Faster path to test actual mailbox behavior with real agents.
- Avoids layering a second queue/dispatcher on top of Pi's built-in message
  queues.

### Risks / downsides

- `sendSystemNotification()` likely needs a small API addition for
  `triggerTurn`.
- Conversation logs have to own durable message identity/order and queryability
  instead of outsourcing them to notifications.
- Existing notification helper may need modest hardening if mailbox stresses it.

### Open questions

- Is `deliverAs: "steer"` always the right default for online conversation nudges,
  or should `followUp` become configurable later?
- Should background-process completion migrate to the same helper before
  conversation work, or remain separate until later?
- Are hidden custom messages sufficient for provider behavior across all current
  Sandpiper providers?

### Prior art evidence

- `agent-stuff` direct session control uses live custom-message injection over
  sockets, relying on Pi delivery rather than a separate notification queue.
- `pi-interactive-subagents` uses widgets/activity snapshots for cheap status and
  `sendMessage(..., triggerTurn: true, deliverAs: "steer")` only for completion,
  errors, and help requests.
- Claude Agent Teams and `pi-agent-teams` frame the product as shared task state
  plus mailbox. Notification-like behavior is delivery/presentation of mailbox
  events, not the central abstraction.
- `pi-crew` separates JSONL mailbox state from live steering/follow-up delivery,
  and explicitly defers full live mailbox runtime until lower-level contracts are
  stable. Its delivery/ack state is useful prior art, but likely heavier than v1
  needs.

### Decision status

Accepted. Notifications for conversation coordination are handled by Sandpiper's
existing system notification envelope and Pi's built-in `sendMessage` queue /
delivery semantics. Add `triggerTurn` support to the helper so online headless
agents can be pushed into a turn for direct request/response or broadcast/channel
delivery. The excluded notification PRD will not be considered in subsequent
conversation architecture discussion.

## Key Change 2 — Durable conversations should be the product center

### Initial recommendation

Move away from a strict "mailbox" / pop-queue analogy and toward a simplified
IRC-like coordination model: durable append-only conversations, direct messages,
channels/rooms/topics, history, live nudges, and agent-queryable logs. The
primary feature is agents discovering peers and participating in shared
coordination conversations, not a general notification bus, leader-managed team
system, or SaaS-style chat product.

### Why this came up

The old work plan appears to route mailbox through notification architecture.
That risks making a supporting mechanism the center of gravity. For multi-agent
coordination, the durable abstraction should be a compact conversation log:
identity, addressing, message state, participants, history, branch/reply
relationships, and user-visible coordination history.

### Current codebase evidence

- Sandpiper has lightweight notifications but no clear conversation/channel
  coordination implementation in the inspected current code.
- Existing persistent extension state can be recorded with Pi custom entries, but
  coordination state likely needs cross-session and possibly cross-process
  access, which points to explicit storage rather than session-only entries.
- Current task and Journal systems are examples of local, durable coordination
  state outside transient model context.

### Benefits if accepted

- Keeps the design aligned with user-visible coordination workflows.
- Prevents notification delivery details from dictating message schema and
  persistence.
- Makes conversation history accessible through agent-facing tools independent
  of active model turns.

### Risks / downsides

- Requires designing conversation storage and lifecycle earlier.
- Channels/rooms introduce naming, history visibility, retention, and compaction
  questions that a simple per-recipient inbox can avoid.
- Product-centered conversation design can expand too quickly unless v1 scope is
  kept tight.
- Append-only history can grow without bound unless disk usage and retention are
  first-class design constraints.

### Open questions

- What is the smallest conversation/channel state model that still supports
  useful coordination?
- Should conversation storage be per-project, per-user, per-session, or some
  hybrid?
- Should messages reference tasks, sessions, channels, files, or all of these?
- Is the system primarily agent-to-agent, agent-to-human, or both? For v1,
  assume agent-to-agent only, with humans interacting indirectly through an
  active agent.
- What is the default channel model: global project channel, task-scoped
  channels, ad-hoc rooms, direct messages, or some subset?
- Should the first storage backend be JSONL, DuckDB, SQLite, or a hybrid?
- How do we preserve low-latency appends/reads and avoid disk-content explosion?

### Prior art evidence

- Claude Agent Teams, `pi-agent-teams`, and `pi-teams` use shared task state plus
  messaging, but they tend to frame messaging as DMs/broadcast within a
  leader/worker team. Sandpiper should borrow durable coordination history while
  avoiding a fixed leader/coordinator topology.
- `pi-agent-teams` broadcast is useful but weaker than channels: late-joining
  agents cannot inspect prior broadcast history unless they were recipients.
- `pi-crew`'s JSONL mailbox is closer to the desired persistence model because
  it treats messages as durable records with IDs, but its delivery/ack state and
  run/task orientation are heavier than a lightweight v1 conversation model.
- IRC with durable logs is a better analogy than Slack: DMs are small
  conversations; channels/rooms provide shared history for subsets of agents;
  live nudges and query results are projections over durable history, not the
  source of truth.

### Discussion notes

The first MVP is **peer-first, not team-first**. Agents should be able to
discover and message other live agents/sessions without a required leader,
coordinator, or team object. This does not rule out team-based organization
later: teams can be a naming convention, membership convention, channel topology,
or higher-level workflow layered on the same peer conversation primitives.

The important shift for the broader model is: **inbox is a view, not storage**. A
queue-like mailbox model implies "pop pending messages and move on." An IRC-like
model keeps an append-only conversation history. The first MVP does not need
these durable records; Broadcast MVP should add them without changing the core
same-host nudge surface.

This fits the brokerless goal. A brokerless implementation can use live session
endpoints for same-host nudges first, then add file-backed conversation metadata
and append-only message logs for broadcast. No central server is required; active
sessions discover state and use Pi/Sandpiper notifications for live delivery.

Broadcast should become a channel post. Channels/rooms/topics allow:

- subsets of agents to coordinate without every live agent receiving a DM,
- task-specific breakout conversations,
- agents that were offline to inspect broadcast/channel history later,
- agents to reconstruct and audit the coordination record,
- future summarization of a channel without losing raw history.

This should stay intentionally minimal. Sandpiper does not need SaaS chat
features such as rich permissions, engagement mechanics, reactions, or a complex
threading UI. The useful subset is append-only logs plus agent-facing tools for
reading, writing, filtering, and notifying on them. There is no standalone human
UI in scope for this system.

Durable storage needs a dedicated design pass for the post-MVP broadcast slice
because the two primary optimization axes are **latency** and **disk usage**.
Prefer established, inspectable formats over custom storage. Durable storage
should be configurable by the user and default to XDG state when unconfigured.
Storage should support multiple conversation scopes, starting with user-global
and cwd-scoped/project broadcast channels. A cwd-safe hierarchy like Pi's
`sessionDir` remains useful for project scopes, but the system should not assume
every durable channel is directory-scoped. JSONL is attractive for append-only
writes, plaintext/debuggability, and DuckDB-based ad-hoc search. DuckDB or SQLite
might be worth evaluating directly if indexes, search, or retention become
awkward in plain files. Human-facing inspection should come from the storage
format's existing tools plus small scripts as needed, not from a bespoke
Sandpiper product UI. Threads can remain simple: either branch metadata modeled
after Pi session branching in JSONL, or database rows that reference a parent
message id / branch root.

The ephemeral messaging MVP does not need durable storage, but it should avoid
API choices that would make the Broadcast MVP awkward later: durable channels,
late-join history, low-latency reads, bounded disk usage, and independent
inspection should remain natural extensions of the surface.

### Decision status

Accepted with reframing. The first MVP is peer-first ephemeral messaging, not
team-first durable coordination. The broader product center remains brokerless
coordination conversations, not notification plumbing and not a strict
mailbox/pop-queue. The analogy is closer to IRC with durable minimal logs than
Slack, but durable logs and broadcast are post-MVP. Direct messages are sent only
to online recipients. Broadcast/channel history is a follow-up slice: agents
should eventually be able to inspect global/project channel history, but the
first MVP should only preserve design affordances for that surface. Active
notifications are delivery mechanisms, not storage. The project task tracker remains the work system.
Conversation messages can reference work items but must not replace them. Latency and disk usage are first-class constraints for any future
storage choice. Nothing in the design should prevent team-based
organization/conventions from being layered on later.

## Key Change 3 — Control agent-to-agent wake cascades by default

### Initial recommendation

Treat `triggerTurn` as the fundamental delivery primitive for online ephemeral
messages. Valid first-MVP recipients are online agents only. Without push
wake-up, online headless agents must discover inbound direct messages through
polling or callers must emulate request/response with tool-call loops. The v1
control points are simpler than a policy subsystem: route only to live endpoints,
never loop messages back to their author, and inject with `deliverAs: "steer"`
plus `triggerTurn: true`. Broadcast should use the same push primitive later,
but is not part of the first MVP.

### Why this came up

A conversation system that can trigger turns can create message loops, cost
explosions, and surprising autonomous behavior. But the risk is not
`triggerTurn` itself; the risk is accidental loopback or broad routing mistakes.
For online headless background agents, `triggerTurn` is the mechanism that lets
an inbound live message become an actual response turn without expensive polling.
The same mechanism will apply to broadcast delivery once Broadcast MVP exists.

### Current codebase evidence

- Pi `sendMessage()` supports `triggerTurn: true`, so recipient wake-up is
  technically possible and does not require a custom notification dispatcher.
- Sandpiper system notifications support steering. For v1 coordination, use
  `steer` and `triggerTurn: true` because steering and turn triggering are orthogonal in Pi.
  `triggerTurn` only matters when the recipient is idle and is ignored while the
  agent is already busy.
- Current Shell Relay and background-process designs show a preference for
  visible collaboration and explicit checking over uncontrolled background model
  work, but this conversation system intentionally targets online agent-to-agent
  push delivery.

### Benefits if accepted

- Enables real asynchronous request/response with online headless background
  agents.
- Avoids pushing coordination into caller-side polling/tool-call loops.
- Preserves the same delivery primitive for Broadcast MVP without forcing
  broadcast into the first MVP.
- Avoids v1 schema/runtime complexity for configurable wake policy, durable logs,
  durable acks, and causal-chain budgets.

### Risks / downsides

- Agents can still socially ping-pong through live DMs, though there is no
  transport-level loopback.
- If Pi/provider errors prevent a turn from completing, the injected message is
  still in the chat context; this failure mode lives above the conversation
  transport and matches prior art that uses `sendMessage`/`sendUserMessage`.
- Broadcast/channel wake-ups can still cause fan-out token spend later if the
  live participant set is large; handle that in Broadcast MVP, not the first MVP.

### Open questions

- Do we need `followUp` as an option later, or is `steer` always right for v1?
- How should an online/offline transition update routeability?
- For Broadcast MVP, how large can the live participant set get before channel
  fan-out becomes too expensive?
- What empirical signal would justify adding coalescing, durable acks, causal
  budgets, or configurable wake policy later?

### Prior art evidence

- `pi-interactive-subagents` is the strongest evidence that push wake-up avoids
  wasteful polling: its tool prompt explicitly says not to poll or tail logs
  because the harness will deliver results with `triggerTurn: true`. It also
  gates status wake-ups: interactive subagents stay quiet, status transitions are
  aggregated/capped, and completions/errors/help requests wake the parent.
- `agent-stuff` direct session control uses socket RPC plus
  `pi.sendMessage(..., { triggerTurn: true })` for live session-to-session
  control. It supports waiting for `turn_end` for request/response, but it is
  direct live RPC rather than durable broadcast/channel coordination.
- `pi-agent-teams` supports DMs and broadcast, including an urgent flag, but its
  implementation is brokered/team-shaped and mailbox-polling based. Broadcast is
  expanded into per-recipient inbox writes; workers poll roughly every few
  hundred milliseconds and leaders poll periodically. It has some dampers
  (`urgent`, busy checks, seen request IDs, batch-completion dedupe, jitter), but
  it does not really solve brokerless push broadcast.
- `pi-teams` is even more polling-oriented: broadcasts are copied to each member
  inbox, and agents poll unread inboxes when idle. This confirms the expensive
  polling / duplicated-message problem we want to avoid.
- `pi-crew` has the most mature durable mailbox schema (JSONL, IDs, delivery
  state, ack, kind/priority/reply fields) and runtime safety concepts
  (depth/concurrency/resource limits, no recursive team spawning), but its full
  live mailbox runtime is explicitly out of scope. It does not directly explore
  broadcast wake cascade control.

### Decision status

Revised and accepted. First MVP should support push wake-up with Pi
`triggerTurn` for online direct addressed request/response. Valid recipients are
online agents only. Default delivery is `deliverAs: "steer"` plus
`triggerTurn: true`. Do not add broadcast/channel delivery, configurable wake
policy, durable read/ack cursors, causal-chain budgets, coalescing,
duplicate-nudge retries, or wake-decision logs in the first MVP unless a measured
problem justifies them. Use author provenance to avoid self-loopback. Broadcast
MVP should reuse this push primitive later.

## Remaining Key Changes After Same-Host IPC Reframe

The remaining discussion should use this model: local Unix IPC first, with
append-only paper-trail logs deferred to the Broadcast MVP rather than treated as
part of the first ephemeral messaging MVP.

1. **Key Change 4 — Layout**: accepted for the ephemeral MVP as UUID-keyed
   runtime claims plus socket endpoints under the per-user runtime root. For the
   Broadcast MVP, still choose durable global/project broadcast log storage.
2. **Key Change 5 — Message schema**: ephemeral DMs do not need durable records in
   v1; define the small immutable broadcast log record, scope fields, and
   branch/reference fields for the Broadcast MVP.
3. **Key Change 6 — Descriptors**: define online routeability, endpoint identity,
   and author identity for v1; default participation in global + cwd broadcast
   channels belongs to the Broadcast MVP.
4. **Key Change 7 — Context**: keep context injection simple; broadcast history is
   queried from logs, not replayed or rewritten into context once broadcast
   exists.

## Key Change 4 — Live same-host routing first, durable scoped logs next

### Reframed recommendation

Do not use the old mailbox directory layout as-is. For the ephemeral messaging
MVP, use a short per-user runtime root with claim files and Unix socket endpoints
keyed by immutable agent UUIDs. Discovery should be a live scan plus socket
handshake, not a cached index. Durable conversation logs are post-MVP design
affordances: when Broadcast MVP is implemented, durable storage should be
user-configurable, default to XDG state, and support at least two built-in
scopes: a user-global broadcast channel and a cwd-derived project broadcast
channel. The layout should assume same-host operation, not a networked broker or
distributed event log.

Runtime root resolution:

- macOS: `${XDG_RUNTIME_DIR:-$TMPDIR}/sandpiper`
- Linux: `${XDG_RUNTIME_DIR:-/run/user/<uid>}/sandpiper`
- If the selected root is unusable, fall back to
  `${TMPDIR:-/tmp}/sandpiper-runtime-<uid>/sandpiper` and warn.
- Create runtime directories with mode `0700`.

Runtime layout:

```text
<runtime root>/
  claims/
    <agentId>.claim
  sockets/
    <collision-free-agentId-prefix>.sock
```

Claim filenames use the full UUIDv4 `agentId`. Socket filenames use the shortest
collision-free UUID prefix, starting at eight hex characters and expanding on
collision. The claim stores the selected endpoint path; identity is validated by
socket handshake, not by the socket basename.

### Why this came up

The older docs imply a session-state layout that does not match Sandpiper as of
this review. The concurrent-session design then used flat PID files under
`$XDG_STATE_HOME/sandpiper/sessions/`, which Sandpiper no longer writes. The
immediate MVP only needs liveness-scoped UDS endpoints and routeability records
used to nudge online agents. Pi session storage demonstrates the cwd-derived
hierarchy convention for future directory-scoped state, but conversation storage
also needs a global scope for floating agents that move across projects when
broadcast is added.

The identity discussion also changed the layout. Every live agent gets a UUIDv4
`agentId`, including guest agents. Guest agents persist that UUID in the Pi
session via `appendEntry`, but do not appear in the global agent directory.
Promotion adds a handle mapping for the existing UUID; it does not move runtime
files or change identity. Handles are global, live in the agent directory, and
are never used as claim or socket path keys.

### Current codebase evidence

- At the time of this review, `packages/core/src/paths.ts` resolved XDG state
  home and session PID paths. Those functions are removed.
- At the time of this review, `.sandpiper/docs/specs/concurrent-sessions.md`
  documented PID files at `$XDG_STATE_HOME/sandpiper/sessions/<uuid>.pid`. It
  now describes the session environment variables only.
- The `session_start` hook in `extensions/system/startup-hooks.ts` passes the
  session id and session file into `setSandpiperSessionEnv`.

### Benefits if accepted

- Avoids reviving stale assumptions.
- Keeps the first MVP focused on live endpoint routing.
- Makes it clear which files are live process routing state and which future files
  are durable history.
- Keeps liveness cleanup focused on stale claims and endpoints.
- Avoids handle/path cache invalidation by keying runtime paths by immutable
  UUIDs.
- Lets guest agents participate without polluting the agent directory.
- Preserves a clean path to durable global/project broadcast logs without forcing
  VCS-tracked project-local logs.

### Risks / downsides

- Need to choose a new live routing layout and migration story if prototypes
  already exist.
- Same-host IPC endpoint cleanup has to be robust enough to avoid routing to dead
  sessions.
- Node/Bun implementation needs a concrete `flock` mechanism; the standard Node
  `fs` API does not expose `flock` directly.
- Handle-based sends have a rename/recycle race unless resolution is rechecked
  before delivery.
- Broadcast MVP will still need clear durable storage precedence rules, path
  expansion, stable cwd-derived scope naming, and noise controls for global
  broadcast.

### Open questions

- What exact schema should the claim file and socket handshake use?
- Which concrete `flock` helper should the Node/Bun implementation use?
- For Broadcast MVP: what durable storage configuration surface, precedence, cwd
  derivation, channel naming, and lock/transaction primitive should be used?

### Prior art evidence

- `agent-stuff` uses a simple control socket directory: discovery iterates live
  socket files, probes connectability, and treats aliases as a convenience layer
  over session sockets.
- That prior art supports live scan plus handshake for tens of agents instead of
  maintaining a cached discovery index.
- `agent-stuff` also shows why aliases/handles should not be the routing
  authority: aliases are useful for UX, but the live endpoint remains the thing
  that must answer.

### Decision status

Accepted with revisions. The first MVP uses a per-user runtime root with
`claims/<agentId>.claim` and `sockets/<short-agentId>.sock`. Claims are identity
attestation only and are held with an exclusive advisory `flock` for the owning
process lifetime. Discovery scans claims, reads the endpoint path, connects to
the socket, and accepts routeability only after the handshake agrees on
`agentId`, `sessionId`, and `pid`.

Every agent receives a UUIDv4 `agentId` at birth. The session persists that UUID
with Pi `appendEntry`; unregistered guest agents are not written to the agent
directory. Handles are global, stored in `$XDG_STATE_HOME/sandpiper/agents.sqlite3`,
and map bidirectionally to registered agent UUIDs. Promotion/rename updates the
directory for the existing UUID; runtime claim and socket paths do not move.

Handle-based routing resolves handle to UUID, performs UUID-based socket
handshake, and rechecks the handle mapping before delivery. Stale cleanup happens
on normal process exit and opportunistically during discovery: if discovery can
acquire the claim's exclusive lock, it treats the claim as stale, unlinks the
socket first, then unlinks the claim, ignoring `ENOENT` races. Durable
global/project broadcast storage and startup channel presence are post-MVP, but
close enough to belong in the initial project backlog as a separate Broadcast MVP
work item once implementation tickets are created.

## Key Change 5 — Keep live DM payloads tiny; reserve rich records for durable logs

### Reframed recommendation

The first MVP live DM schema should be intentionally tiny. The model-facing
message only needs sender identity and message text. The IPC frame still carries
a message id so the runtime can correlate transport acknowledgements and errors:

```json
{
  "format": "tattler.agent-message.v1",
  "id": "<message-id>",
  "from": "<agentId>",
  "message": "<text>"
}
```

The socket handler resolves `from` through the agent directory for display,
reshapes the payload into a compact system notification, and injects only what
the recipient LLM needs to act. Do not inject timestamps, PIDs, session ids,
delivery settings, message ids, handle snapshots, or durable-log metadata by
default. If a message needs a large artifact, the sender should write a
file/task/note and send a reference rather than embedding the artifact.

Transport acknowledgement is runtime-only. After accepting and delivering the
message into the local harness, the receiver IPC handler returns a
`tattler.ack.v1` frame containing the receiving `agentId` and `messageId`. If the
handler rejects the message, it returns `tattler.error.v1` with receiving
`agentId`, optional `messageId`, and an error payload. These frames do not imply
LLM comprehension, semantic handling, or an agent-authored reply.

Durable broadcast-channel messages will need more structure than a raw live DM,
but that belongs to the Broadcast MVP. The broadcast slice should use a compact
immutable record with stable id, channel/conversation id, scope, sequence/order,
author provenance, timestamp, body, optional parent/branch metadata, and typed
references to tasks/sessions/files/URLs where useful.

### Why this came up

Live DMs enter the recipient's LLM context, so every extra field costs tokens and
can distract the model. Most transport/provenance metadata helps storage,
debugging, or future append-log queries, but it does not help the recipient model
handle the message. Semantic "handled" acknowledgement is not reliable without
model tool calls, and adding ack tools would clutter the agent surface while
still relying on model honesty.

### Current codebase evidence

- Sandpiper system notifications already let the socket handler inject a compact
  recipient-facing message instead of raw transport metadata.
- Pi `sendMessage` delivery options (`deliverAs` and `triggerTurn`) live outside
  the message body and do not need to be repeated in the LLM-facing payload.
- Future durable broadcast records can still use Pi session ids, Sandpiper task
  keys, and session files as provenance/reference anchors without putting those
  fields in live DM context.

### Benefits if accepted

- Keeps the recipient's LLM context focused on the actual coordination message.
- Keeps IPC framing and notification rendering simple.
- Reduces token cost and future Pi session persistence noise.
- Preserves room for richer durable broadcast records without forcing that shape
  into the live DM path.
- Avoids v1 tool/context clutter from explicit semantic ack/read semantics while
  still giving the IPC layer transport-level ack/error correlation.

### Risks / downsides

- Minimal live payloads provide less built-in debugging context unless socket
  handlers log or expose transport details separately.
- If the sender spoofs `from`, the receiver must rely on socket/claim handshake
  validation rather than trusting the frame alone.
- Large freeform messages can still create context pressure; enforce a size cap
  and ask senders to reference external artifacts instead.
- Without durable semantic read/ack state, "handled" remains a model/context-level
  concern above the conversation transport.

### Open questions

- Should the 4096-byte live DM payload cap count UTF-8 bytes after encoding or
  JavaScript string code units? Prefer UTF-8 bytes.
- Should live DM `message` be constrained to UTF-8 text for MVP, or accept bytes
  and render only text payloads?
- What exact compact prose should the system notification inject for registered
  and guest senders?
- For Broadcast MVP, what is the minimum durable channel message schema?
- For Broadcast MVP, is `parentMessageId` / `branchRootId` enough for simple
  threads/branches?
- For Broadcast MVP, how are sequence numbers allocated safely under concurrent
  append?
- For Broadcast MVP, should messages be immutable after append?
- For Broadcast MVP, should references be typed (`task`, `session`, `file`,
  `url`) or freeform?

### Prior art evidence

- `agent-stuff`'s direct session RPC treats live sends as a small command with a
  message string; richer operations like summaries and subscriptions are separate
  commands, not metadata on every message.
- `pi-interactive-subagents` reinforces that important live nudges should be
  concise and purpose-built rather than requiring the model to parse a large
  status envelope.
- Durable mailbox prior art (`pi-crew`, `pi-agent-teams`) contains richer ids,
  timestamps, reply fields, priority, and delivery state, but those fields serve
  log/query/coordination needs rather than the minimal recipient context for a
  live DM.

### Decision status

Accepted with revisions. The first MVP live DM payload is minimal:
`tattler.agent-message.v1` with `id`, `from`, and `message`; `from` is the sender
UUID, and `message` is constrained text. The receiving socket validates sender
identity through the claim/socket handshake, resolves the UUID to a handle if one
exists, and injects compact prose through the existing Sandpiper system
notification path. The runtime returns `tattler.ack.v1` after local delivery or
`tattler.error.v1` on rejection/failure. Transport/provenance metadata may exist
in handler state or future logs, but it should not enter LLM context by default.

Broadcast MVP should define a separate compact immutable append-log record for
durable global/project channels. That record can include ids, timestamps,
sequence/order, channel scope, author provenance, handle snapshots, reply/branch
metadata, and typed references as needed, but it should not be copied wholesale
into live notification context.

## Key Change 6 — Discovery exposes passive identity and routeability, not semantic status

### Reframed recommendation

Do not make descriptors semantic status records in the first MVP. Discovery
should expose only passive, truthful identity/routing facts that the runtime can
answer without interrupting or waking another agent: `agentId`, optional global
handle, guest/registered kind, `sessionId`, `pid`, launch cwd, session file,
routeability, and protocol capabilities such as `dm-v1`. Human-readable semantic
routing should come from curated global handles, not inferred current focus. If
an agent needs to know what another agent is actually working on, it should send
an explicit message.

Broadcast participation is a post-MVP descriptor/directory extension: when the
Broadcast MVP starts, every live agent can advertise participation in the
user-global broadcast channel and the cwd-scoped/project broadcast channel.

### Why this came up

Fields like cwd, role, focus, active task, and capability can look useful but are
semantically slippery. Launch cwd is not always the work target. Most agents have
the same tool suite, so broad "capability" lists do not distinguish them. Role
and focus can change within a conversation and cannot be updated reliably without
model cooperation. Discovery should not inject tool calls, trigger turns, or wake
other agents just to ask what they are doing.

### Current codebase evidence

- Session hooks can access cwd, session id, and session file without asking the
  model.
- Runtime claims and socket handshakes already establish `agentId`, `sessionId`,
  `pid`, endpoint routeability, and protocol support.
- The global agent directory can materialize registered handles without
  duplicating handle data into runtime claims.
- Startup/task/Journal context may be useful to a human, but it is not reliable
  enough to present as current online status without explicit updates.

### Benefits if accepted

- Avoids fake precision in agent discovery results.
- Avoids waking or interrupting other agents for `list_online_agents`.
- Keeps discovery cheap: scan claims, handshake sockets, join against the agent
  directory.
- Lets global handles carry human-curated semantic meaning when it matters.
- Keeps protocol capabilities concrete and testable instead of turning them into
  vague role labels.

### Risks / downsides

- Discovery is less descriptive for anonymous guest agents.
- Users or agents must intentionally message a target to learn current semantic
  focus.
- Launch cwd and session file can still leak cross-project context if shown too
  broadly; keep discovery same-user/local and concise.
- If future workflow wants rich status, it will need explicit status ownership
  and update semantics rather than passive descriptors.

### Open questions

- What exact passive fields should `list_online_agents` display by default versus
  hide behind a verbose flag?
- What protocol capability names are concrete enough for MVP (`dm-v1`, possibly
  `describe-v1`) without becoming role labels?
- How should inactive but resumable sessions appear in tools if they are not
  valid DM recipients?
- In Broadcast MVP, can agents opt out of global or project broadcast presence,
  or is default participation mandatory?

### Prior art evidence

- `agent-stuff`'s `list_sessions` discovers live control sockets and aliases; it
  does not ask the model to describe its current work.
- `pi-interactive-subagents` separates cheap runtime status from important
  message injection, reinforcing that discovery/status should not be confused
  with LLM context or semantic self-reporting.
- Team/mailbox prior art exposes richer task/status views, but those depend on
  explicit workflow state. Sandpiper's ephemeral DM MVP does not have such a
  workflow state owner yet.

### Decision status

Accepted with revisions. First-MVP discovery is passive routeability discovery,
not semantic status. `list_online_agents` scans runtime claims, handshakes
sockets, and joins against the global agent directory to display UUID, handle
when registered, guest/registered kind, session id, pid, and concrete protocol
capabilities. Guest agents display as `guest:<short-uuid>`. It does not show
launch cwd or session file by default, query the model, trigger a turn, infer
current focus, or rely on agents to update descriptor files. Current intent or
focus is learned through an explicit DM.

## Key Change 7 — Do not rewrite session context for conversation v1

### Reframed recommendation

Do not add context rewriting or collapsed synthetic spans for conversation v1.
Inject online nudges through existing Pi/Sandpiper message delivery as compact
prose, not raw transport envelopes. Once broadcast exists, let agents query
durable logs through tools when they need history.

### Why this came up

Conversation notifications and messages may eventually create context pressure,
but rewriting Pi session context is a high-blast-radius solution. Current Pi
already has a session tree, custom messages, compaction summaries, and branch
summaries. The conversation system should not manipulate that machinery unless
real usage proves simpler presentation and query strategies are insufficient.

### Current codebase evidence

- Pi `CustomMessageEntry` participates in LLM context.
- Pi `CustomEntry` persists state but does not enter LLM context.
- Pi context building walks the session tree from the current leaf and handles
  compaction specially.
- Current Sandpiper notification protocol is intentionally lightweight and uses
  hidden custom messages rather than a separate context-rewriting subsystem.

### Benefits if accepted

- Avoids high-risk session-history manipulation in v1.
- Keeps conversation state separate from context presentation.
- Keeps the recipient's LLM context small by injecting only sender display and
  message text.
- Lets us learn which context behavior is actually needed.

### Risks / downsides

- Context can still grow noisy if agents exchange many live DMs.
- If channel event volume becomes high after Broadcast MVP, context hygiene may
  need a future summarization or bounded-injection strategy.
- If agents start long autonomous conversations through broadcasts, their
  transcript footprint will need separate design.

### Open questions

- What is the expected volume of ephemeral message nudges per online session?
- For Broadcast MVP, can history be summarized at read/query time instead of
  rewriting history after the fact?
- For Broadcast MVP, should offline broadcast history be mentioned in startup
  context, or only be discoverable through tools?
- How does compaction summarize hidden system notifications today?

### Prior art evidence

- `pi-interactive-subagents` keeps cheap status in a widget/activity file and
  injects only important result/ping messages into the parent context.
- Claude Agent Teams, `pi-agent-teams`, and `pi-teams` rely on shared task state,
  inboxes/status views, and ordinary message injection rather than
  session-history rewriting.
- `pi-crew` uses explicit mailbox replay and status/query views; it does not
  require context rewriting as the mailbox foundation.

### Decision status

Accepted for v1. Do not rewrite Pi session context for conversation delivery.
Live DMs inject compact prose through the existing system notification path,
carrying only what the recipient model needs to act. Revisit only if real usage
creates context pressure that cannot be handled through tool-queryable summaries,
bounded notification content, or normal Pi compaction.

## Cross-Cutting Questions

- What exact claim, greeting, agent-message, ack, and error JSON Schemas should
  be distributed for the accepted `format` identifiers?
- For Broadcast MVP, how should durable conversation scopes be modeled beyond
  the built-in global and cwd/project broadcast channels?
- How should conversation state interact with task-tracker state once durable
  broadcast exists?
- For Broadcast MVP, what configuration surface should choose durable storage,
  and how should the XDG default / global / cwd-derived hierarchy be named?
- For Broadcast MVP, which established storage backend best balances low-latency
  appends/reads, low disk usage, easy search, independent inspection, and simple
  crash recovery: JSONL, DuckDB, SQLite, or a hybrid?
- What same-user local trust boundary is assumed? Remote/multi-user coordination
  is out of scope for v1.
- What agent-facing tools should exist for the ephemeral MVP beyond list online
  agents and send ephemeral DM? For Broadcast MVP: post to global/project
  broadcast, read broadcast history, reply/branch, reference task?
- Should there eventually be direct human participation or non-agent inspection
  surfaces, or should human access remain mediated through agents asking these
  tools? Direct human participation is deferred beyond v1.

## Candidate Validation Spike

Before implementing the full MVP below, build the smallest useful Tattler spike to
validate live agent-to-agent messaging quickly. This spike should be closer to
`agent-stuff`'s `control.ts` than to the final layered architecture.

Spike goals:

- Prove live agent-to-agent messages are useful in real Sandpiper sessions.
- Validate compact notification injection and context impact.
- Learn whether agents can coordinate without handles, durable logs, or rich
  discovery.

Spike shape:

- UDS stream socket per live session/process under the runtime root.
- NDJSON framing.
- One message format, intentionally marked pre-contract, e.g.
  `tattler.agent-message.v0`.
- Message frame carries only `format`, `from`, and `message`; `from` can be a
  session id or short display string for the spike.
- Recipient injects compact system notification prose.
- Agent-facing tools:
  - list live endpoints/sessions
  - send a message to a live endpoint/session
- No global handles, agent directory, stable agent UUIDs, claim/flock ownership,
  handshake/greeting, ack/error correlation, protocol registry, JSON Schema
  distribution, or durable storage in the spike unless needed to unblock basic
  usability.

The spike is disposable/upgradeable. Do not let v0 shortcuts become the named MVP
contract.

## Candidate First MVP Slice

This is not a decision, only the current strawman to evaluate after the
validation spike proves the interaction is valuable.

- Product/package name: Tattler, project key `TAT` when implementation
  tasks are created.
- Package shape: standalone packages with a thin Pi/Sandpiper
  binding layer.
- Package split:
  - `@sandpiper-ai/tattler-core`: runtime roots, UUID/session binding interface,
    agent directory lookup, claim/flock ownership, socket server/client,
    greeting/handshake, protocol registry/dispatch, discovery/retry/error types.
  - `@sandpiper-ai/tattler-agent-message`: protocol format
    `tattler.agent-message.v1`, payload schema, 4096-byte UTF-8 cap, compact notification rendering helper,
    and handler factory accepting a delivery callback.
  - `@sandpiper-ai/tattler`: product/metapackage entrypoint composing core and
    built-in protocols.
- `tattler-core` is runtime/IPC only; it does not know about LLMs, Pi, system
  notifications, or agent messaging semantics.
- User-supplied startup identity uses `--agent-name <handle>` to register a
  persistent global handle from launch. If the handle exists and is not live,
  reuse the existing agent UUID. If the handle exists and is live, error. If the
  handle is absent, register the current session UUID with that handle.
- Live identity changes use `/rename-agent <handle>`; if the target handle exists,
  error, otherwise move the existing UUID to the new handle and make the old
  handle immediately reusable.
- Conversation extension ensures the current session has a UUIDv4 `agentId`,
  persisted through Pi `appendEntry` as
  `'sandpiper:agent-identity', { agentId: '...', agentHandle?: '...' }`.
- Conversation extension opens a claim file under the per-user runtime root,
  holds an exclusive advisory `flock`, and starts a Unix socket endpoint.
- Claim includes `agentId`, `sessionId`, `pid`, endpoint path, and claim time; it
  does not include mutable status or handle data.
- Guest agents have no directory entry. Registered agents materialize their
  global handle from `$XDG_STATE_HOME/sandpiper/agents.sqlite3`.
- Agent directory MVP schema uses one `agents` table keyed by `agent_id` with
  unique `handle`; `created_at` and `updated_at` are managed by SQLite defaults
  and update triggers rather than application code. Connections set
  `PRAGMA recursive_triggers = OFF`; the MVP trigger can still be narrow, such as
  `AFTER UPDATE OF handle`, to encode the current mutability contract.
- Handle syntax: `[a-z0-9][a-z0-9._-]{0,63}`.
- Agent-facing tools:
  - list online agents/sessions by scanning live claims and reading Tattler
    greetings
  - send ephemeral direct message to an online agent by UUID or handle through the
    `tattler.agent-message.v1` format
- Tattler core uses NDJSON/JSONL framing, one command per short-lived stream
  connection. All Tattler JSON artifacts use a `format` discriminator with dot
  hierarchy: `tattler.<name>.v<major>`.
- On connect, the server sends a `tattler.greeting.v1` frame with `agentId`,
  `sessionId`, `pid`, and an `accepts` object describing supported frame formats.
- Agent-sent frames use their own top-level `format`; there is no generic request
  wrapper in the first MVP.
- `tattler.agent-message.v1` is the only first-MVP agent-sent format. It carries
  `id`, `from`, and `message`; payload cap is 4096 UTF-8 bytes.
- The receiver IPC handler responds with `tattler.ack.v1` after local delivery or
  `tattler.error.v1` on rejection/failure. Acks/errors carry the receiving
  `agentId` and the `messageId` being acknowledged when parseable.
- Initial core error codes: `BAD_REQUEST`, `UNSUPPORTED_FORMAT`,
  `MESSAGE_TOO_LARGE`, `IDENTITY_MISMATCH`, `DELIVERY_FAILED`, and
  `INTERNAL_ERROR`.
- Inbound same-host nudges produce hidden system notifications with compact prose,
  not raw transport metadata.
- Online recipient agents are nudged with `deliverAs: "steer"` and
  `triggerTurn: true` for direct addressed request/response.
- DMs are ephemeral and valid only to online agents.
- Handles resolve to UUIDs before routing; handle-based sends recheck the mapping
  before delivery.
- `list_online_agents` omits launch cwd and session file by default; those can be
  added later or exposed only through verbose output if needed.
- No durable logs, broadcast delivery, durable read/ack protocol, retry framework,
  coalescing layer, configurable wake policy, or context span rewriting in the
  first MVP.

## Candidate Broadcast MVP Slice

This should become its own project backlog item when implementation tickets are
created; no task has been created yet.

- Durable storage resolves from user configuration or XDG default.
- Durable storage supports global and cwd/project broadcast scopes.
- Startup presence includes both the user-global broadcast channel and the
  cwd-scoped/project broadcast channel.
- Broadcast-channel messages are compact append-only records with stable ids,
  sequence/order, author provenance, channel id, scope (`global` or cwd/project),
  and optional branch/reply metadata.
- Storage choice is explicitly evaluated against latency and disk-usage budgets;
  avoid duplicating message bodies per recipient.
- Agent-facing tools:
  - list durable broadcast channels (`global` and current project/cwd)
  - post to global/project broadcast
  - list/read global/project broadcast channel history
  - reply/branch from a message and reference tasks/sessions/files
- Broadcast channel traffic is delivered to live participants other than the
  author; agents that were offline inspect channel history later through tools if
  needed.

## Decision Log

| Date       | Decision                                                                    | Rationale                                                                                                                                                                                                                                                                                                                              | Follow-up                                                                                                                                                                                                       |
| ---------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-14 | Treat the seven changes as hypotheses, not final decisions.                 | Prior art scan may change the framing.                                                                                                                                                                                                                                                                                                 | Review each change after scan.                                                                                                                                                                                  |
| 2026-05-14 | Exclude the old notification subsystem PRD from conversation architecture.  | Sandpiper already has a system notification XML envelope, and Pi already owns message queueing/delivery via `sendMessage`; the PRD's extra queue/dispatcher/handling-turn/context-rewriter design is unnecessary for this work.                                                                                                        | Add `triggerTurn` support to `sendSystemNotification()`.                                                                                                                                                        |
| 2026-05-14 | Reframe mailbox as brokerless conversations/channels.                       | A pop-queue mailbox model loses useful history. The first MVP keeps only ephemeral online DMs; the broader model can later add durable broadcast channels and treat durable private conversations as channels with two participants.                                                                                                   | Rename/refactor future spec language away from strict "mailbox" terminology where practical.                                                                                                                    |
| 2026-05-14 | Keep the conversation system purely agent-facing for v1.                    | The first MVP goal is live agent-to-agent messaging through tools, not a standalone human UI/TUI/dashboard or SaaS chat surface. Direct human participation as a conversation actor is interesting but out of scope for v1.                                                                                                            | Specify agent tool contracts before any human-facing interface work.                                                                                                                                            |
| 2026-05-14 | Use established, inspectable storage formats.                               | Human-facing inspection should come from existing tools for the chosen storage format plus small scripts when needed; avoid inventing a custom format that requires Sandpiper-specific UI to inspect.                                                                                                                                  | Include independent inspection ergonomics in the storage evaluation.                                                                                                                                            |
| 2026-05-14 | Make the MVP peer-first, not team-first.                                    | Brokerless peer conversations avoid requiring a leader/coordinator/team object, while still allowing teams to emerge later as naming, membership, channel, or workflow conventions.                                                                                                                                                    | Ensure v1 schema does not bake in a mandatory team/leader hierarchy.                                                                                                                                            |
| 2026-05-14 | Use `triggerTurn` for online direct delivery, and later broadcast delivery. | Online headless agents cannot respond to inbound messages without starting a turn; forcing callers to emulate request/response with tool calls and polling is the wrong abstraction. Same-host UDS/SHM nudges are reliable enough for v1, and Pi's own queue handles injected messages. Broadcast should use the same primitive later. | Add `triggerTurn` support to the helper; define online routeability and author self-suppression. Defer broadcast, append-before-nudge ordering, wake policy, acks, coalescing, and budgets until measured need. |
| 2026-05-14 | Scope first MVP to ephemeral online DMs only.                               | Because DMs are only valid between online agents, they do not need durability in v1. Durable private conversations can later be modeled as ordinary channels/conversations with two participants, not as a special DM subsystem.                                                                                                       | Keep first MVP tools/storage focused on live DM IPC.                                                                                                                                                            |
| 2026-05-14 | Name the product Tattler and split core/protocol packages.                  | A tattler is a sandpiper relative known for being loud/chatty, matching the agent-messaging product shape. Tattler should be a standalone package family with a thin Pi binding layer: core owns same-host identity/IPC and protocols layer on top.                                                                                    | Use project key `TAT`; create `@sandpiper-ai/tattler-core`, `@sandpiper-ai/tattler-agent-message`, and product/metapackage `@sandpiper-ai/tattler` when implementation tasks are created.                       |
| 2026-05-14 | Use UUID-keyed runtime claims and global agent directory for identity.      | Every agent needs stable attribution before durable logs exist, but throwaway guests should not pollute the directory. UUID-keyed claims avoid handle/path cache invalidation; global handles remain renameable aliases stored in SQLite.                                                                                              | Persist `agentId` in session state via Pi `appendEntry`; implement runtime roots, claim `flock`, scan-plus-handshake discovery, and `$XDG_STATE_HOME/sandpiper/agents.sqlite3`.                                 |
| 2026-05-14 | Build a smaller validation spike before the full Tattler MVP.               | The layered MVP design addresses real footguns, but the fastest path to value is a `control.ts`-style v0 spike that proves live agent-to-agent messaging and compact notification injection in real sessions.                                                                                                                          | When creating implementation tickets, start with a disposable/upgradeable Tattler v0 spike before agent directory, stable UUID identity, claim locks, handshakes, ack/error correlation, or schemas.            |
| 2026-05-14 | Treat Broadcast MVP as a near-term post-MVP backlog item.                   | Global broadcast supports cross-project/floating agents; cwd broadcast keeps project coordination local. It is important enough to create project backlog work when implementation tickets are created, but it should not be part of the first ephemeral messaging MVP.                                                                | When creating implementation tickets, add a Broadcast MVP task covering global/cwd durable logs, startup presence, and broadcast tools.                                                                         |
