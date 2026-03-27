# TUI Extension Patterns

Practical reference for building TUI components in sandpiper extensions. Based on
studying Pi's internals, the extension API, and the `@mariozechner/pi-tui` component
library. Complements the official [TUI docs](../../node_modules/@mariozechner/pi-coding-agent/docs/tui.md)
with patterns specific to our use cases.

**Official resources:**
- TUI docs: `$PI_CODING_AGENT_PACKAGE/docs/tui.md`
- Extension docs: `$PI_CODING_AGENT_PACKAGE/docs/extensions.md`
- Examples: `$PI_CODING_AGENT_PACKAGE/examples/extensions/` (especially `message-renderer.ts`, `preset.ts`, `tools.ts`)

## Imports

```typescript
// From pi-coding-agent — DynamicBorder, BorderedLoader, theme helpers
import { DynamicBorder } from '@mariozechner/pi-coding-agent';

// From pi-tui — core layout and text components
import { Container, Text, Box, Spacer, Markdown } from '@mariozechner/pi-tui';

// Types
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
```

Both packages are pi peer dependencies. In the root `tsconfig.json`, they need `paths`
entries to resolve types. In `package.json`, they go in `peerDependencies` with the
`catalog:pi` version.

## Three Ways to Show Content

### 1. `ctx.ui.notify(message, type)` — Simple Chat Messages

Adds plain text to the chat container. Flows with chat (scrolls up).

```typescript
ctx.ui.notify('Something happened', 'info');    // dim text
ctx.ui.notify('Watch out', 'warning');           // yellow, prepends "Warning: "
ctx.ui.notify('Bad news', 'error');              // red, prepends "Error: "
```

**Internals:**
- `'info'` → `showStatus()` → wraps in `theme.fg("dim", message)`. Has coalescing behavior (replaces last status if consecutive).
- `'warning'` → `showWarning()` → wraps in `theme.fg("warning", "Warning: " + message)`. No coalescing.
- `'error'` → `showError()` → wraps in `theme.fg("error", "Error: " + message)`. No coalescing.

**Limitations:** No component support. The entire message is wrapped in a single color,
so embedded ANSI codes get layered (inner codes override for their span, but resets kill
the outer color too). No `DynamicBorder`, no custom layout.

**Use when:** Simple one-off notifications where plain text suffices.

### 2. `ctx.ui.setWidget(key, content, options?)` — Persistent Widgets

Renders content **above or below the editor**. Persists until explicitly cleared.
Does NOT flow with chat — stays pinned ("sticky").

```typescript
// String array — simple, but limited to MAX_WIDGET_LINES (10)
ctx.ui.setWidget('my-widget', ['Line 1', 'Line 2']);

// Factory function — full component control, no line limit
ctx.ui.setWidget('my-widget', (_tui, theme) => {
  const container = new Container();
  container.addChild(new DynamicBorder((s: string) => theme.fg('warning', s)));
  container.addChild(new Text(theme.bold(theme.fg('warning', 'Heading')), 1, 0));
  container.addChild(new DynamicBorder((s: string) => theme.fg('warning', s)));
  return {
    render: (w: number) => container.render(w),
    invalidate: () => container.invalidate(),
  };
});

// Placement below editor
ctx.ui.setWidget('my-widget', lines, { placement: 'belowEditor' });

// Clear
ctx.ui.setWidget('my-widget', undefined);
```

**Internals:**
- String arrays are wrapped in a `Container` with `Text` components, sliced to 10 lines.
- Factory functions bypass the line limit — they receive `(tui, theme)` and return a component.
- Widgets are stored in `extensionWidgetsAbove` / `extensionWidgetsBelow` maps, keyed by the string key.
- Cleared on session reset (`/new`, `/resume`, etc.).

**Use when:** Persistent status/diagnostics that should stay visible regardless of chat scroll position.

### 3. `pi.registerMessageRenderer()` + `pi.sendMessage()` — Rich Chat Messages

The proper way to put **component-level content into the chat flow**. Combines the
rich rendering of `setWidget` with the chat-flowing behavior of `notify`.

```typescript
// Register renderer (in extension factory, before event handlers)
pi.registerMessageRenderer<MyDetails>('my-custom-type', (message, _options, theme) => {
  const container = new Container();
  container.addChild(new DynamicBorder((s: string) => theme.fg('warning', s)));
  container.addChild(new Text(theme.bold(theme.fg('warning', 'Heading')), 1, 0));
  // ... build component tree ...
  container.addChild(new DynamicBorder((s: string) => theme.fg('warning', s)));
  return container;
});

// Send message (in event handler)
pi.sendMessage({
  customType: 'my-custom-type',
  content: '',           // can be empty if renderer handles everything
  display: true,         // must be true to render in chat
  details: { ... },      // typed payload, available as message.details in renderer
});
```

**Internals:**
- `sendMessage` creates a `CustomMessageEntry` in the session.
- Interactive mode wraps it in `CustomMessageComponent`, which:
  - Adds `Spacer(1)` automatically before the message
  - Calls your renderer with `(message, { expanded }, theme)`
  - If renderer returns a component, uses it directly (no wrapping, no background)
  - If renderer returns undefined or throws, falls back to default rendering (purple box with label + markdown)
- The component is added to `chatContainer` — it flows with chat, scrolls up naturally.

**Use when:** Rich notifications that need borders, styled text, or custom layout AND should flow with chat. This is how Pi's own "Update Available" banner works internally.

## Key Components

### DynamicBorder

Renders a horizontal rule of `─` characters, full terminal width.

```typescript
import { DynamicBorder } from '@mariozechner/pi-coding-agent';

// Default border color
new DynamicBorder();

// Custom color — MUST type the parameter
new DynamicBorder((s: string) => theme.fg('warning', s));
```

Renders: `────────────────────────────────` (repeated to fill width).

**Important:** `DynamicBorder` is a standalone component, not a Text wrapper. It must be
added as a child of a Container, not embedded in a string.

### Text

Multi-line text with word wrapping and padding. Supports embedded ANSI escape codes.

```typescript
import { Text } from '@mariozechner/pi-tui';

new Text('content', paddingX, paddingY, bgFn?);
// paddingX: left/right padding in chars (default: 1)
// paddingY: top/bottom empty lines (default: 1)
// bgFn: optional background color function

// Multi-line: use \n in the content string
new Text(`${heading}\n${body}\n${footer}`, 1, 0);
```

**Important:** Text uses `wrapTextWithAnsi()` — long lines wrap to the next line, preserving
ANSI codes. A line of 200 `─` characters would wrap, not truncate. For full-width borders,
use `DynamicBorder` (it knows the render width).

### Container

Groups child components vertically. No built-in spacing between children.

```typescript
import { Container } from '@mariozechner/pi-tui';

const container = new Container();
container.addChild(component1);
container.addChild(component2);
container.removeChild(component1);
container.clear(); // remove all children
```

### Spacer

Empty vertical space.

```typescript
import { Spacer } from '@mariozechner/pi-tui';
new Spacer(2);  // 2 empty lines
```

## Theme Colors

Access via the `theme` parameter in renderers/factories. Never import theme directly.

```typescript
theme.fg('warning', text)    // yellow — warnings, attention
theme.fg('accent', text)     // cyan — commands, URLs, interactive elements
theme.fg('muted', text)      // gray — secondary info, descriptions
theme.fg('dim', text)        // dimmer gray — timestamps, metadata
theme.fg('success', text)    // green
theme.fg('error', text)      // red
theme.fg('border', text)     // default border color
theme.bold(text)             // bold (can nest: theme.bold(theme.fg('warning', text)))
```

Full color list in the TUI docs under "Theming".

## Pi's Internal Update Banner (Reference Pattern)

This is what we're matching. Pi has direct `chatContainer` access — extensions achieve
the same result via custom message renderers.

```javascript
// From interactive-mode.js — showNewVersionNotification
showNewVersionNotification(newVersion) {
    const action = theme.fg("accent", getUpdateInstruction("@mariozechner/pi-coding-agent"));
    const updateInstruction = theme.fg("muted", `New version ${newVersion} is available. `) + action;
    const changelogUrl = theme.fg("accent", "https://github.com/.../CHANGELOG.md");
    const changelogLine = theme.fg("muted", "Changelog: ") + changelogUrl;
    this.chatContainer.addChild(new Spacer(1));
    this.chatContainer.addChild(new DynamicBorder((text) => theme.fg("warning", text)));
    this.chatContainer.addChild(new Text(`${theme.bold(theme.fg("warning", "Update Available"))}\n${updateInstruction}\n${changelogLine}`, 1, 0));
    this.chatContainer.addChild(new DynamicBorder((text) => theme.fg("warning", text)));
    this.ui.requestRender();
}
```

Structure: `Spacer` → `DynamicBorder(warning)` → `Text(heading + body)` → `DynamicBorder(warning)`.

## Invalidation

Components that embed theme colors must rebuild on `invalidate()`:

```typescript
class MyComponent extends Container {
  private data: SomeData;
  constructor(data: SomeData) {
    super();
    this.data = data;
    this.rebuild();
  }
  private rebuild(): void {
    this.clear();
    this.addChild(new Text(theme.fg('accent', this.data.title), 1, 0));
  }
  override invalidate(): void {
    super.invalidate();
    this.rebuild();
  }
}
```

Not needed for:
- Factory functions passed to `setWidget` (re-called on theme change)
- `DynamicBorder` with color callback (called during render)
- Custom message renderers (called fresh each render)

## Timing: Chat Message Placement

Messages added to the chat during `session_start` appear **before** Pi's startup info
([Context], [Skills], [Prompts], [Extensions]). To place a message **after** the startup
section (like Pi's own update banner), use fire-and-forget — don't `await` the async work:

```typescript
// ❌ Appears above startup info (awaited = synchronous in the handler)
pi.on('session_start', async (_event, ctx) => {
  const updates = await checkForUpdates();
  for (const u of updates) pi.sendMessage({ ... });
});

// ✅ Appears below startup info (fire-and-forget = resolves after render)
pi.on('session_start', async (_event, ctx) => {
  checkForUpdates().then((updates) => {
    for (const u of updates) pi.sendMessage({ ... });
  });
});
```

Pi uses this same pattern internally — `this.checkForNewVersion().then(...)` in `run()`.
The network latency naturally pushes the notification below the startup content.

## Pitfall: Event Listener Accumulation on /reload

`pi.events.on()` listeners accumulate across `/reload` cycles. The event bus persists
for the lifetime of the process, but extension factories re-register listeners each time
`/reload` runs. If your system collects results by emitting an event and gathering responses,
you'll get duplicate results after each reload.

**Fix:** Deduplicate by a stable key rather than relying on listener count:

```typescript
// ❌ Accumulates duplicates across reloads
export function collectChecks(pi: HasEvents): Result[] {
  const results: Result[] = [];
  pi.events.emit(EVENT, (r: Result) => results.push(r));
  return results;
}

// ✅ Deduplicates by key — reload-safe
export function collectChecks(pi: HasEvents): Result[] {
  const seen = new Map<string, Result>();
  pi.events.emit(EVENT, (r: Result) => seen.set(r.key, r));
  return [...seen.values()];
}
```

## Pitfall: New Core Exports Require Full Restart

Adding a new module to a workspace package (e.g., `sandpiper-ai-core`) and re-exporting it
requires a **full agent restart** to take effect — `/reload` does not re-resolve the module
dependency graph. jiti caches the module graph in memory for the session lifetime, so even
with `moduleCache: false`, already-resolved packages aren't re-imported.

**Symptom:** `Export named 'myNewFunction' not found in module '...core/src/index.ts'`
after `/reload` following a new module addition.

**Fix:** Quit and relaunch sandpiper.

## Decision Guide

| Need | Use | Why |
|------|-----|-----|
| Simple one-off notification | `ctx.ui.notify()` | Minimal code, flows with chat |
| Persistent status/diagnostics | `ctx.ui.setWidget()` with factory | Stays visible, full component control |
| Rich notification that scrolls | `registerMessageRenderer` + `sendMessage` | Components in chat flow |
| Interactive UI (selection, input) | `ctx.ui.custom()` | Takes over editor, handles keyboard |
| Footer info | `ctx.ui.setStatus()` or `ctx.ui.setFooter()` | Persistent, minimal |
