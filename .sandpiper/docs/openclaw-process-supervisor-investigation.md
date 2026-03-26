# OpenClaw Process/Supervisor Investigation

**Date:** 2026-03-26
**Context:** SHR-70 — Spike: replace unbuffer-relay with proper PTY allocation approach
**Repo:** [openclaw/openclaw](https://github.com/openclaw/openclaw) (MIT license)

## What Is OpenClaw?

OpenClaw is a personal AI assistant platform (~337K GitHub stars) built in TypeScript/Node.js. It's a large monorepo that provides:

- A local-first **Gateway** (WebSocket control plane) for sessions, channels, tools, and events
- **Multi-channel messaging** (WhatsApp, Telegram, Slack, Discord, Signal, iMessage, IRC, Matrix, and ~15 more)
- A **Pi agent runtime** in RPC mode with tool streaming
- Companion apps for macOS, iOS, and Android
- Tool integrations including browser control, canvas, cron, and — most relevant to us — **exec/process management**

The runtime is Node 22+/24, uses pnpm for builds, and is structured as a single monorepo (not workspaces/packages). The process subsystem lives at `src/process/` within the main source tree.

## Architecture of the Process/Supervisor Subsystem

### Module Map

```
src/process/
├── supervisor/
│   ├── types.ts           # Core type definitions (RunRecord, RunExit, ManagedRun, SpawnInput, ProcessSupervisor interface)
│   ├── index.ts           # Singleton accessor + re-exports
│   ├── supervisor.ts      # Main supervisor implementation (createProcessSupervisor)
│   ├── registry.ts        # In-memory run registry (RunRecord state machine)
│   └── adapters/
│       ├── child.ts       # child_process.spawn adapter (SpawnProcessAdapter)
│       ├── pty.ts          # @lydell/node-pty adapter (SpawnProcessAdapter)
│       └── env.ts          # ProcessEnv → Record<string, string> helper
├── exec.ts                # runExec(), runCommandWithTimeout() — standalone execution
├── command-queue.ts       # Lane-based command serialization (Main, Cron, Subagent, Nested)
├── kill-tree.ts           # Process tree termination (SIGTERM→grace→SIGKILL, cross-platform)
├── spawn-utils.ts         # spawn-with-fallback pattern (retry on EBADF, etc.)
├── child-process-bridge.ts # Signal forwarding for child processes (systemd/launchd compat)
├── restart-recovery.ts    # In-process restart iteration hook
├── lanes.ts               # CommandLane enum
├── windows-command.ts     # Windows .cmd/.bat shim resolution
└── test-timeouts.ts       # Test timeout constants

src/agents/
├── bash-tools.process.ts       # The `process` agent tool (list/poll/log/write/send-keys/kill)
├── bash-process-registry.ts    # Session registry (running/finished, output buffering, drain/sweep)
├── pty-dsr.ts                  # Strip PTY DSR (Device Status Report) sequences from output
├── pty-keys.ts                 # Encode key sequences + paste for PTY sessions
└── shell-utils.ts              # Resolve user shell + args (cross-platform)

src/types/
└── lydell-node-pty.d.ts        # Type declarations for @lydell/node-pty
```

### How It Fits Together

1. **`ProcessSupervisor`** is the core abstraction — it manages spawning, timeout enforcement, output capture, and cancellation for both child processes and PTY sessions.

2. **Two spawn modes** via the adapter pattern:
   - `mode: "child"` → `createChildAdapter()` wraps `child_process.spawn` with detach, stdio piping, Windows compatibility
   - `mode: "pty"` → `createPtyAdapter()` wraps `@lydell/node-pty` (a maintained fork of `node-pty`)

3. **The supervisor** orchestrates:
   - Unique run IDs (UUID)
   - Overall timeout and no-output timeout enforcement (both via `setTimeout`)
   - Output capture (optional — can stream-only without retaining)
   - Scope-based cancellation (`cancelScope` cancels all runs in a scope)
   - State machine tracking via the `RunRegistry`
   - Graceful cleanup on exit/error

4. **The agent integration layer** (`bash-tools.process.ts` + `bash-process-registry.ts`) adds:
   - Session naming and listing
   - Backgrounding semantics (foreground runs that exceed `yieldMs` get auto-backgrounded)
   - Incremental output draining (`poll`) vs. full log retrieval (`log`)
   - stdin writing, key sequence sending, paste support
   - Finished session sweeping (TTL-based cleanup)

5. **The command queue** (`command-queue.ts`) provides lane-based serialization — different execution contexts (main, cron, subagent) can run concurrently but within each lane commands are serialized. Supports graceful draining for gateway restart.

### Key Design Decisions

- **In-memory only** — no disk persistence for running/finished sessions. Sessions are lost on restart. This keeps it simple.
- **Adapter pattern** for spawn backends — clean separation between the supervisor logic and the actual process/PTY spawning.
- **Singleton supervisor** — one global instance per process, accessed via `getProcessSupervisor()`.
- **`@lydell/node-pty`** as the PTY backend — this is a community-maintained fork of Microsoft's `node-pty`, kept alive after the original was effectively abandoned. It provides native PTY allocation on all platforms.
- **Graceful kill** — `killProcessTree()` sends SIGTERM to the process group, waits a grace period, then SIGKILL. On Windows, uses `taskkill /T`.
- **PTY unified output** — PTY mode gives a single output stream (onStdout only; onStderr is a no-op) because PTYs multiplex stdout/stderr.

## Relevance to Our Shell Relay

### What We Need vs. What They Built

| Our Need | OpenClaw's Solution |
|----------|-------------------|
| PTY allocation for color output | `createPtyAdapter()` via `@lydell/node-pty` |
| Process lifecycle management | `ProcessSupervisor` with state machine |
| Output capture (stdout/stderr) | Streaming + optional retention in `RunExit` |
| Timeout enforcement | Overall + no-output timeouts |
| Graceful process termination | `killProcessTree()` with SIGTERM→grace→SIGKILL |
| Background task management | `bash-process-registry.ts` + `process` tool |
| Command serialization | `command-queue.ts` lane-based serialization |

### What We DON'T Need

- **Windows compatibility** — `windows-command.ts`, `resolveWindowsCommandShim`, `.cmd/.bat` handling, `taskkill` paths. We can drop all of this.
- **Gateway/session integration** — `sessionId`, `backendId`, `scopeKey` fields on `SpawnInput` are OpenClaw Gateway concepts. We'd simplify to our own identifiers.
- **Agent tool layer** — `bash-tools.process.ts` is tightly coupled to OpenClaw's agent tool API (`@mariozechner/pi-agent-core` tool interface). We'd write our own pi extension tool.
- **Command queue/lanes** — `command-queue.ts` is sophisticated but we already have our own promise-chain serialization in `relay.ts`. We might adopt this later but it's not needed for the PTY replacement.
- **Shell resolution** — `shell-utils.ts` does PowerShell resolution and fish→bash fallback. We detect shells differently.
- **Session registry** — `bash-process-registry.ts` has output buffering and sweeping that's specific to OpenClaw's backgrounding model. We have our own FIFO-based capture.

## Analysis: Vendor, Adapt, or Write Our Own?

### Option A: Vendor the OpenClaw process subsystem

**Pros:**
- Battle-tested in a 337K-star project
- Comprehensive edge case handling (especially on Windows, which we don't even need)
- Good test coverage

**Cons:**
- **Heavy for our needs.** The `src/process/` directory alone is ~12 files, plus agent-layer files and type declarations. Probably ~2,000+ lines of code, of which we'd use maybe 30%.
- **Non-trivial extraction.** The code imports from sibling modules throughout the OpenClaw source tree (`../../agents/shell-utils.js`, `../../logging/subsystem.js`, `../../globals.js`, `../../infra/openclaw-exec-env.js`). These aren't isolatable without stubbing.
- **Not structured as a package.** This is a monorepo interior module, not a standalone library. There's no `package.json`, no clean public API boundary. Vendoring would require manually tracing and extracting transitive dependencies.
- **Maintenance burden.** Vendored code drifts. Keeping it updated means re-extracting from the monorepo periodically, which is labor-intensive when the code isn't modular.
- **Semantic mismatch.** Their `ProcessSupervisor` is designed for OpenClaw's Gateway lifecycle (session scoping, backend IDs, reconcile-orphans hook). We'd be working around these concepts rather than with them.

**Verdict: Not recommended.** The extraction cost and ongoing maintenance burden aren't justified given how much we'd actually use.

### Option B: Adapt the concepts into our own small library

**Pros:**
- We get the design patterns (adapter pattern, state machine registry, timeout enforcement, graceful kill) without the baggage
- We can target exactly our use cases (PTY color output, background tasks for the agent)
- Clean, small codebase that we fully understand and maintain
- No transitive dependency extraction problems

**Cons:**
- More upfront work than vendoring (if vendoring were clean, which it isn't)
- We might miss edge cases they've already solved

**What we'd take from OpenClaw's design:**
1. **Adapter pattern** — `SpawnProcessAdapter` interface with `child` and `pty` implementations. This is the core good idea and it's simple to recreate.
2. **`@lydell/node-pty`** as the PTY backend — confirmed as the right choice (maintained fork, cross-platform).
3. **Graceful kill-tree** — SIGTERM→grace→SIGKILL pattern for process groups. ~40 lines of code for the Unix path.
4. **Timeout strategy** — both overall and no-output timeouts, with clear state transitions. Clean pattern, easy to implement.
5. **State machine** — `starting → running → exiting → exited` with termination reasons. Nice for debugging.

**What we'd skip:**
1. Windows support entirely
2. Gateway/session/scope concepts
3. Spawn-with-fallback retry logic
4. Command queue/lanes (we have our own serialization)
5. Shell resolution (we detect shells our own way)
6. The entire agent tool layer (we'll build our own pi tools)

**Estimated size of our version:** ~400-600 lines total for a clean process supervisor library:
- Types: ~50 lines
- Supervisor: ~150 lines
- Child adapter: ~60 lines
- PTY adapter: ~80 lines
- Kill tree (Unix only): ~40 lines
- Registry: ~80 lines
- Tests: ~200 lines

Compare to ~2,000+ lines in OpenClaw's version (and that's just the process directory, not counting agent integration).

**Verdict: Recommended.** The design is good; the code is overbuilt for our needs. Write our own, informed by their patterns.

### Option C: Use `@lydell/node-pty` directly without a supervisor

**Pros:**
- Minimal code — just wrap the PTY spawn in our existing relay infrastructure
- Solves the immediate unbuffer-relay problem without new abstractions

**Cons:**
- Misses the opportunity for a general background-task framework
- We'd still need timeout enforcement, graceful killing, and lifecycle management — which is what a supervisor provides
- If we want background tasks later, we'd retrofit the supervisor on top

**Verdict: Viable for a quick PTY-only fix, but not recommended if we want the broader background-task capability.**

## The Broader Opportunity: Background Tasks for the Agent

The user's insight is right — OpenClaw's process tool isn't just about PTY allocation. It gives the agent the ability to:

1. **Start a long-running task** (build, test suite, watcher) and immediately continue the conversation
2. **Poll for output** incrementally without blocking
3. **Send input** (stdin, key sequences, paste) to running processes
4. **Kill or manage** running processes
5. **List all running/recent sessions** for situational awareness

This is a fundamentally different capability than our current shell relay, which is synchronous — the agent sends a command and waits for output. A background process framework would let the agent:

- Kick off `bun test --watch` in the background and keep coding
- Start a build and check on it later
- Run a long research spike (web scraping, data processing) without blocking
- Monitor multiple concurrent tasks

For Sandpiper, this would be a significant capability upgrade. The PTY fix is the entry point, but the background-task framework is the real prize.

## Decision

**Option B: Write our own lean library, informed by OpenClaw's design patterns.** (Decided 2026-03-26)

The work is split into two tickets:
- **SHR-71** (LOW) — PTY MVP: replace `unbuffer-relay` with `@lydell/node-pty` adapter. Focused, minimal scope.
- **SHR-72** (LOW) — Background process framework: general-purpose supervisor for long-running tasks. Builds on SHR-71, separate effort for down the road.

Key insight from discussion: the background framework isn't just about the shell relay. It has two distinct motivations:
1. **Replace the Zellij backgrounding mechanism** (`ghost-attach` + `--create-background`) with in-process session management — not replacing Zellij itself, but how we background it.
2. **General agent capability** — run any long-running task (test suites, builds) without blocking the chat. This is a stepping stone toward both background processes and subagents, neither of which Pi provides today.

## Original Recommended Approach (Pre-Decision, Preserved for Context)

1. **Create a new `packages/process-supervisor/` workspace package** with a clean, minimal process supervisor inspired by OpenClaw's design patterns
2. **Use `@lydell/node-pty`** as the PTY backend (add as a dependency)
3. **Implement the adapter pattern** with `child` and `pty` spawn modes
4. **Add timeout enforcement** (overall + no-output) and graceful kill-tree
5. **Keep it framework-independent** — no pi imports in the library, following our existing architecture pattern
6. **Build a pi extension tool** (or extend shell-relay) that uses the supervisor for background process management
7. **Retire `unbuffer-relay`** once the PTY adapter is wired into the shell integration scripts

### Native Addon Consideration

`@lydell/node-pty` is a native addon, and our AGENTS.md says "Do NOT introduce native addons" for portability. However, the practical concern is minimal:

- **No `node-gyp` or compiler required.** The package uses the platform-specific optional dependencies pattern (like esbuild, SWC, Rollup): the main package declares `@lydell/node-pty-darwin-arm64`, `@lydell/node-pty-linux-x64`, etc. as `optionalDependencies`. The package manager downloads only the matching prebuilt binary — no compilation step.
- **PTY allocation is inherently platform-specific** — it requires kernel calls (`forkpty`/`openpty` on Unix, `CreatePseudoConsole` on Windows). There is no pure-JS alternative.
- The guideline exists to prevent portability issues from native compilation. Prebuilt binaries with platform detection sidestep that concern entirely.
- Coverage: darwin-x64, darwin-arm64, linux-x64, linux-arm64, win32-x64, win32-arm64.

### Comparison: `@lydell/node-pty` vs. `script` Command

| Aspect | `@lydell/node-pty` | `script -q /dev/null cmd` |
|--------|-------------------|--------------------------|
| PTY allocation | Full control (cols, rows, env, name) | Limited (inherits terminal size) |
| Output capture | Programmatic (onData callback) | Must parse file or pipe stdout |
| stdin support | Write directly to PTY | Not supported (stdin not piped) |
| Cross-platform | macOS, Linux, Windows | macOS, Linux (different flags!) |
| Dependencies | Prebuilt native addon (no compiler needed) | Zero (system utility) |
| Background tasks | Natural fit (spawn + manage lifecycle) | Awkward (no lifecycle control) |
| Process management | Full (pid, kill, wait) | Limited (must manage externally) |

For background-task framework ambitions, `@lydell/node-pty` is clearly the right choice. For a minimal PTY-only fix with no new dependencies, `script` works on our target platforms (macOS primarily).

## Files of Interest for Future Reference

If we decide to reference OpenClaw's implementation during our own build:

| File | Why |
|------|-----|
| `src/process/supervisor/types.ts` | The type definitions are well-designed — good starting point for our own |
| `src/process/supervisor/supervisor.ts` | Main orchestration logic — timeout, cancel, state management |
| `src/process/supervisor/adapters/pty.ts` | How they wrap `@lydell/node-pty` — force-kill fallback timer is a nice touch |
| `src/process/kill-tree.ts` | Clean graceful-kill implementation |
| `src/process/supervisor/registry.ts` | In-memory state machine with pruning |
| `docs/gateway/background-process.md` | Their user-facing docs for the feature — good UX reference |
