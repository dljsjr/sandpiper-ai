---
name: tui
description: >-
  Use when building, modifying, or debugging TUI components in sandpiper extensions.
  Triggers include: adding borders or decorations to banners or notifications, making
  a widget flow with the chat vs. stay pinned above the editor, using DynamicBorder,
  custom message renderers, registerMessageRenderer, sendMessage, setWidget, ctx.ui.notify,
  styled text in extensions, theme colors (warning, accent, muted), pi TUI components
  (Container, Text, Spacer, Box), controlling where a notification appears in the UI,
  "sticky widget", "chat flow", extension UI, or any work on the visual output of a
  sandpiper extension.
---

# Pi TUI Extension Patterns

Reference for building TUI components in sandpiper extensions. **Read
`.sandpiper/docs/tui-extension-patterns.md` for the full reference** — this skill
provides orientation and the key decision guide.

## Three Ways to Show Content

| API | Placement | Component support | Use when |
|-----|-----------|-------------------|----------|
| `ctx.ui.notify(msg, type)` | Chat (flows up) | None — plain text, single color | Simple one-off notifications |
| `ctx.ui.setWidget(key, factory)` | Above/below editor (sticky) | Full — DynamicBorder, Container, etc. | Persistent status/diagnostics that should stay visible |
| `pi.registerMessageRenderer` + `pi.sendMessage` | Chat (flows up) | Full — DynamicBorder, Container, etc. | Rich notifications that need borders/styling AND should scroll with chat |

**The key tradeoff:** `setWidget` = sticky but full components. `notify` = chat-flowing but plain text only. `registerMessageRenderer` + `sendMessage` = chat-flowing AND full components — the right choice for styled banners.

## notify() internals

```typescript
ctx.ui.notify('msg', 'info')     // → showStatus()   → dim text, coalescing (replaces consecutive calls)
ctx.ui.notify('msg', 'warning')  // → showWarning()  → yellow, prepends "Warning: "
ctx.ui.notify('msg', 'error')    // → showError()    → red, prepends "Error: "
```

All three wrap the entire message in a single color — embedded ANSI styling partially works
but is unreliable. Never use `notify` when you need `DynamicBorder`.

## Custom Message Renderer Pattern

```typescript
// In the extension factory (runs once at load):
pi.registerMessageRenderer<MyDetails>('sandpiper-my-type', (message, _options, theme) => {
  const container = new Container();
  container.addChild(new DynamicBorder((s: string) => theme.fg('warning', s)));
  container.addChild(new Text(theme.bold(theme.fg('warning', 'Heading')), 1, 0));
  container.addChild(new Text(
    theme.fg('muted', 'Body text ') + theme.fg('accent', 'accent part'),
    1, 0
  ));
  container.addChild(new DynamicBorder((s: string) => theme.fg('warning', s)));
  return container;
});

// In a session_start or event handler:
pi.sendMessage({
  customType: 'sandpiper-my-type',
  content: '',      // can be empty — renderer handles display
  display: true,    // must be true
  details: myData,  // typed payload available as message.details in renderer
});
```

`CustomMessageComponent` automatically adds `Spacer(1)` before the component.
If the renderer returns `undefined`, falls back to default purple-box rendering.

## Chat Placement Timing

Messages sent during `session_start` appear **before** Pi's startup info ([Context], [Skills], etc.).
To appear **after** (like Pi's own update banner), use fire-and-forget:

```typescript
// ❌ Appears above startup info
pi.on('session_start', async (_event, ctx) => {
  const data = await fetchSomething();
  pi.sendMessage({ ... });
});

// ✅ Appears below startup info — network latency pushes it after render
pi.on('session_start', async (_event, ctx) => {
  fetchSomething().then((data) => {
    pi.sendMessage({ ... });
  });
});
```

## DynamicBorder

Renders `────────────────────` (repeated `─` to full terminal width). Must be a Container child — not embeddable in text strings.

```typescript
import { DynamicBorder } from '@mariozechner/pi-coding-agent';
// Always type the color param explicitly:
new DynamicBorder((s: string) => theme.fg('warning', s));
```

## Theme Color Roles

```typescript
theme.fg('warning', text)   // yellow — warnings, headings
theme.fg('accent', text)    // cyan — commands, URLs, actions
theme.fg('muted', text)     // gray — secondary info
theme.fg('dim', text)       // dimmer — timestamps, metadata
theme.bold(text)            // bold — combine: theme.bold(theme.fg('warning', text))
```

## Preflight Check Duplication on /reload

`pi.events.on()` listeners accumulate across `/reload` cycles (the event bus persists,
but extension factories re-register). Deduplicate by key when collecting:

```typescript
export function collectPreflightDiagnostics(pi: HasEvents): PreflightDiagnostic[] {
  const seen = new Map<string, PreflightDiagnostic>();
  pi.events.emit(PREFLIGHT_EVENT, (d: PreflightDiagnostic) => seen.set(d.key, d));
  return [...seen.values()];
}
```

## Adding new core package exports

Adding a new module to `sandpiper-ai-core` requires a **full agent restart** after building —
`/reload` does not re-resolve the dependency tree. jiti caches the module graph in memory
for the lifetime of the session.

## Full Reference

`.sandpiper/docs/tui-extension-patterns.md` — complete patterns, Pi internals analysis,
component API details, and decision guide.

Pi framework references (relative to `$PI_CODING_AGENT_PACKAGE`):
- `docs/tui.md` — component API, theming, overlays, keyboard input
- `docs/extensions.md` — sendMessage, registerMessageRenderer, setWidget, lifecycle
- `examples/extensions/message-renderer.ts` — canonical custom renderer example
