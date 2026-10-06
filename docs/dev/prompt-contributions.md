# Cross-extension prompt contributions

- **Diátaxis mode**: Explanation
- **Applies to**: Extension authors contributing content to the system prompt
- **Task**: AGENT-216
- **Contract owner**: AGENT-214 (`extensions/system/prompt-contributions.ts`)

## The problem

Sandpiper's system prompt extension replaces Pi's base prompt wholesale in its `before_agent_start` hook (on Pi 1.0, by setting `systemPromptOptions.customPrompt`). Any `before_agent_start` handler that appends to `event.systemPrompt` before Sandpiper's handler runs will have its contribution discarded. On Pi 1.0, a handler that returns `systemPrompt` also forces that text for the current run only, without recording it in the transcript; contribute through the channel below or through `systemPromptOptions.sections` instead.

This is the bug that broke the YAAMS memory bootstrap: `pi-yaams` appended a `<memory>` block to the system prompt, then Sandpiper's startup hook rebuilt the prompt from scratch and lost the block.

The root cause is compositional: the `before_agent_start` event chains system prompt mutations across handlers, but a handler that *replaces* the prompt (instead of appending to it) breaks the chain for any earlier handler.

## Why not just fix the ordering?

Extension load order in Pi is deterministic but not easily controllable:

1. **Project-local** extensions (`.sandpiper/extensions/`)
2. **Global** extensions (`agentDir/extensions/`)
3. **Configured package** extensions (from `settings.json`)
4. **Inline extension factories** (Sandpiper identity, bundled tools)

Configured packages load before inline factories, so `pi-yaams` (a package) runs before Sandpiper's startup hook (inline). Reordering these is possible but brittle — it couples correctness to an implicit ordering contract that extension authors may not know about.

## The lifecycle-based coordination pattern

Instead of relying on load order, use Pi's guaranteed lifecycle sequence:

```
all extension factories load/await
  │
  ├─► session_start
  ├─► resources_discover
  │
  ▼
per turn:
  ├─► before_agent_start
```

The invariant: by the time `session_start` fires, every extension has registered its lifecycle handlers. By the time `resources_discover` fires, every `session_start` handler has completed.

This means:

1. **`session_start`**: The prompt-building extension subscribes to the `sandpiper:prompt-contribution` event bus channel and resets any cached contributions from a prior session.

2. **`resources_discover`**: Other extensions emit their prompt contribution registrations on that channel. The listener is already present — no durability needed.

3. **`before_agent_start`**: The prompt-building extension collects all registered contributions, resolves their content (which may be async), applies `prepend` contributions before the rebuilt Sandpiper prompt and default/`append` contributions after it, then freezes the resolved content for subsequent turns.

## The ratified contract

The canonical contract is exported by AGENT-214 in `extensions/system/prompt-contributions.ts`:

```typescript
export const SANDPIPER_PROMPT_CONTRIBUTION_CHANNEL = 'sandpiper:prompt-contribution';

export interface SandpiperPromptContribution {
  readonly id: string;
  readonly phase?: 'prepend' | 'append';
  readonly acknowledge?: () => void;
  readonly getContent: () => string | Promise<string | undefined> | undefined;
}
```

### Contract rules

1. **Contributors must emit during `resources_discover`** (or later, before the first `before_agent_start`). Emitters during factory/init are not guaranteed to find a listener.

2. **Event bus handlers must be synchronous** — `pi.events.emit()` does not await async handlers. Do registration/enqueue only in the handler; defer async work to `getContent()`.

3. **Each contributor provides an `id`** for deduplication. `resources_discover` can fire on reload; the collector deduplicates by trimmed `id`, first wins.

4. **`phase` controls position in the assembled prompt**: `'prepend'` blocks are placed before the Sandpiper prompt; default/`'append'` blocks are placed after it. This is a position directive, not a category label.

5. **`getContent()` should be cacheable** — the prompt builder calls it once per session on the first `before_agent_start`, then freezes the resolved content for subsequent turns to preserve provider prefix-cache stability.

6. **Contributors do not modify `event.systemPrompt`** — the prompt builder owns the final assembly. Contributors provide content; the builder decides placement.

7. **Contributors may provide an `acknowledge()` callback.** The collector calls it synchronously when the contribution is accepted (valid shape, first `id` wins). Duplicate `id`s do not re-ack. Extensions use this to detect whether the collector is present — if `acknowledge` is called, the Sandpiper collector owns the contribution and the extension should skip direct `before_agent_start` mutation. If `acknowledge` is never called (e.g., running in plain Pi without the Sandpiper collector), the extension falls back to legacy direct-append behavior.

### Example: contributing extension

```typescript
import { SANDPIPER_PROMPT_CONTRIBUTION_CHANNEL } from 'sandpiper-ai-core';

pi.on("resources_discover", async (_event, _ctx) => {
  pi.events.emit(SANDPIPER_PROMPT_CONTRIBUTION_CHANNEL, {
    id: "my-extension-prompt-block",
    phase: "append",
    getContent: async () => buildPromptBlock(),
  });
});
```

## Event bus constraints

The event bus (`pi.events`) is a thin wrapper over Node's `EventEmitter`. It is **not durable** — messages emitted with no listener are dropped silently. This is fine for the coordination pattern above because the listener is registered in `session_start` before emitters fire in `resources_discover`.

The protocol is synchronous registration, deferred content resolution: the handler enqueues the contribution object synchronously; async content generation happens later via `getContent()` during prompt assembly.

## Alternative: preserve tags

A simpler but less principled alternative: extensions wrap their prompt contributions in a known XML tag before appending to `event.systemPrompt`, and the Sandpiper startup hook parses those tags out of the incoming prompt before rebuilding, then re-appends them afterward.

```xml
<sandpiper-preserve source="pi-yaams" id="memory-bootstrap">
  ...extension-owned prompt block...
</sandpiper-preserve>
```

This works with the current `before_agent_start` chain without changing the protocol, but it relies on string parsing of the prompt — something the Sandpiper system prompt architecture explicitly avoids. It's a reasonable bridge but not the long-term API.

## Why not a Pi API for prompt contributions?

A first-class `pi.registerPromptBlock()` API would be the cleanest solution:

- Extensions register blocks during init
- The prompt builder collects them at assembly time
- No event bus protocol needed
- No load-order dependence

This would require a change to Pi's extension API. The lifecycle-based coordination pattern described here works with the current API and can be replaced by a proper Pi API when one becomes available.

## Prefix-cache stability

The system prompt is part of the provider's prompt cache. If it changes between turns, the cache is invalidated and the full prompt must be re-processed, increasing cost and latency.

The coordination pattern preserves cache stability by:

1. Resolving contributor content only once per session (on the first `before_agent_start`)
2. Freezing the resolved content for subsequent turns
3. Not re-resolving contributors on later turns

If contributor content genuinely needs to change mid-session (e.g., after a memory write), the tradeoff is: either accept a cache miss for that turn, or defer the new content to the next session. Which is correct depends on the use case.

## Open design questions

### Harness-agnostic fallback

The `acknowledge()` callback enables harness-agnostic fallback: when the Sandpiper collector accepts a contribution, it calls `acknowledge()`, and the contributing extension knows to skip its own `before_agent_start` mutation. If no collector acknowledges (e.g., running in plain Pi), the extension falls back to direct `before_agent_start` append — the legacy behavior. This is the detection mechanism for "collector is present" that was previously unresolved.

### Verifying prompt contributions in live agents

If a contribution block is correctly assembled in `before_agent_start`, it is visible in the agent's context. An agent that cannot see a contribution block does not have it — do not rationalize missing blocks as self-introspection unreliability.

For verification, use:
- `YAAMS_BOOTSTRAP_DEBUG_FILE` — pi-yaams writes the computed block (or skip reason) to this file
- `SANDPIPER_DUMP_SYSTEM_PROMPT` — Sandpiper dumps the final assembled prompt and exits
- A `before_provider_request` hook that captures the actual provider payload — this is the strongest proof, since it shows the exact bytes sent to the model

### Turns started by extensions skip `before_agent_start`

Pi emits `before_agent_start` only for prompted runs (`AgentSession.prompt()`, which `pi.sendUserMessage` also uses). A run started by `pi.sendMessage(..., { triggerTurn: true })` while the agent is idle, as Tattler, Chorus, and background-process wakes do, never emits it, so contributions are not re-resolved on those turns.

On Pi 1.0, Sandpiper's prompt still reaches those turns. Sandpiper records its prompt, contributions included, in the session transcript through Pi's custom base prompt, and Sandpiper's local Pi patch keeps the recorded prompt for runs that skip `before_agent_start` (upstream [pi#5581](https://github.com/earendil-works/pi/issues/5581)). The exception is a fresh session whose first run is such a turn: no prompt is recorded yet, so that run uses Pi's own prompt. See the [Sandpiper system prompt architecture](../../.sandpiper/docs/specs/sandpiper-system-prompt.md).

The CC bridge `begin_turn` drift handling (described above) is a separate improvement but was not the live root cause.

## See also

- [Pi extension development](pi-extension-development.md) — Sandpiper extension surfaces and Pi API reference
- [Sandpiper system prompt architecture](../../.sandpiper/docs/specs/sandpiper-system-prompt.md) — current prompt construction internals
- Pi docs: `$PI_CODING_AGENT_PACKAGE/docs/extensions.md` — lifecycle event order and handler contracts
