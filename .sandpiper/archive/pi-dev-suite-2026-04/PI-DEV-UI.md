# Pi Custom UI (TUI) Developer Guide

**Target**: Developers building custom TUI components  
**Related**: [PI-DEV-QUICKSTART.md](./PI-DEV-QUICKSTART.md), [PI-DEV-ADVANCED.md](./PI-DEV-ADVANCED.md)

---

## Component Interface

All TUI components implement:

```typescript
interface Component {
  render(width: number): string[];
  handleInput?(data: string): void;
  wantsKeyRelease?: boolean;
  invalidate(): void;
}
```

| Method | Purpose |
|--------|---------|
| `render(width)` | Return lines (each ≤ width) |
| `handleInput(data)` | Receive keyboard input |
| `wantsKeyRelease` | Receive key release events (Kitty protocol) |
| `invalidate()` | Clear cached render state |

---

## Built-in Components

```typescript
import { Text, Box, Container, Spacer, Markdown, SelectList } from "@mariozechner/pi-tui";
```

### Text

```typescript
const text = new Text(
  "Hello World",
  1,  // paddingX
  1,  // paddingY
  (s) => theme.bg("selectedBg", s)  // Optional background
);

text.setText("Updated text");
```

### Box

```typescript
const box = new Box(
  1,  // paddingX
  1,  // paddingY
  (s) => theme.bg("customMessageBg", s)
);

box.addChild(new Text("Content", 0, 0));
```

### Container

```typescript
const container = new Container();
container.addChild(component1);
container.addChild(component2);
container.removeChild(component1);
```

### Spacer

```typescript
const spacer = new Spacer(2);  // 2 empty lines
```

### Markdown

```typescript
import { getMarkdownTheme } from "@mariozechner/pi-coding-agent";

const md = new Markdown(
  "# Title\n\nSome **bold** text",
  1,  // paddingX
  1,  // paddingY
  getMarkdownTheme()
);

md.setText("Updated markdown");
```

---

## Custom Components

### Basic Component

```typescript
import { matchesKey, Key, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";

class MySelector {
  private items: string[];
  private selected = 0;
  private cachedWidth?: number;
  private cachedLines?: string[];
  
  public onSelect?: (item: string) => void;
  public onCancel?: () => void;

  constructor(items: string[]) {
    this.items = items;
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.up) && this.selected > 0) {
      this.selected--;
      this.invalidate();
    } else if (matchesKey(data, Key.down) && this.selected < this.items.length - 1) {
      this.selected++;
      this.invalidate();
    } else if (matchesKey(data, Key.enter)) {
      this.onSelect?.(this.items[this.selected]);
    } else if (matchesKey(data, Key.escape)) {
      this.onCancel?.();
    }
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    this.cachedLines = this.items.map((item, i) => {
      const prefix = i === this.selected ? "> " : "  ";
      const color = i === this.selected ? "accent" : "text";
      return truncateToWidth(
        prefix + item,
        width
      );
    });
    
    this.cachedWidth = width;
    return this.cachedLines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}
```

### Usage with ctx.ui.custom()

```typescript
pi.registerCommand("pick", {
  handler: async (_args, ctx) => {
    const items = ["Option A", "Option B", "Option C"];
    
    const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
      const selector = new MySelector(items);
      
      selector.onSelect = (item) => done(item);
      selector.onCancel = () => done(null);
      
      return {
        render(width) { return selector.render(width); },
        invalidate() { selector.invalidate(); },
        handleInput(data) {
          selector.handleInput(data);
          tui.requestRender();
        }
      };
    });
    
    if (result) {
      ctx.ui.notify(`Selected: ${result}`, "info");
    }
  }
});
```

---

## Overlays

### Basic Overlay

```typescript
const result = await ctx.ui.custom<string | null>(
  (tui, theme, _kb, done) => new MyDialog(tui, theme, done),
  {
    overlay: true,
    overlayOptions: {
      anchor: "center",
      width: 50,
      maxHeight: 20
    }
  }
);
```

### Overlay Positioning

```typescript
overlayOptions: {
  // Size
  width: "50%",           // Percentage
  minWidth: 40,           // Minimum columns
  maxHeight: "80%",       // Maximum rows
  
  // Anchor-based positioning (9 positions)
  anchor: "right-center", // "center", "top-left", "top-center", "top-right",
                          // "left-center", "right-center", 
                          // "bottom-left", "bottom-center", "bottom-right"
  offsetX: -2,            // Offset from anchor
  offsetY: 0,
  
  // Or percentage positioning
  row: "25%",             // 25% from top
  col: 10,                // Column 10
  
  // Margins
  margin: 2,              // All sides
  margin: { top: 1, right: 2, bottom: 1, left: 2 },
  
  // Responsive visibility
  visible: (termWidth, termHeight) => termWidth >= 80
}
```

### Overlay with Handle

```typescript
let overlayHandle: OverlayHandle | null = null;

await ctx.ui.custom(
  (tui, theme, _kb, done) => new MyComponent(tui, theme, done),
  {
    overlay: true,
    onHandle: (handle) => {
      overlayHandle = handle;
      // Can call handle.setHidden(true/false) later
    }
  }
);

// Later: toggle visibility
overlayHandle?.setHidden(!isVisible);
```

---

## Focusable Interface (IME Support)

For components with text cursors (CJK input):

```typescript
import { CURSOR_MARKER, type Focusable } from "@mariozechner/pi-tui";

class MyInput implements Component, Focusable {
  focused: boolean = false;  // Set by TUI when focus changes
  
  render(width: number): string[] {
    const marker = this.focused ? CURSOR_MARKER : "";
    
    return [`> ${beforeCursor}${marker}\x1b[7m${atCursor}\x1b[27m${afterCursor}`];
  }
  
  handleInput(data: string) {
    // Handle input...
  }
  
  invalidate() {}
}
```

### Container with Embedded Input

```typescript
class SearchDialog extends Container implements Focusable {
  private searchInput: Input;
  private _focused = false;
  
  get focused(): boolean {
    return this._focused;
  }
  
  set focused(value: boolean) {
    this._focused = value;
    this.searchInput.focused = value;  // Propagate to child
  }
  
  constructor() {
    super();
    this.searchInput = new Input();
    this.addChild(this.searchInput);
  }
}
```

---

## Custom Editors

### Extend CustomEditor

```typescript
import { CustomEditor } from "@mariozechner/pi-coding-agent";

class ModalEditor extends CustomEditor {
  private mode: "normal" | "insert" = "insert";
  
  handleInput(data: string): void {
    if (matchesKey(data, "escape")) {
      if (this.mode === "insert") {
        this.mode = "normal";
      } else {
        super.handleInput(data);  // Pass to agent
      }
      return;
    }
    
    if (this.mode === "insert") {
      super.handleInput(data);
    } else {
      // Normal mode: vim-like keys
      if (data === "h") super.handleInput("\x1b[D");
      if (data === "j") super.handleInput("\x1b[B");
      if (data === "k") super.handleInput("\x1b[A");
      if (data === "l") super.handleInput("\x1b[C");
      if (data === "i") this.mode = "insert";
    }
  }
  
  render(width: number): string[] {
    const lines = super.render(width);
    
    // Add mode indicator
    const mode = this.mode === "normal" ? " NORMAL" : " INSERT";
    if (lines.length > 0) {
      lines[lines.length - 1] = lines[lines.length - 1]!.slice(0, -mode.length) + mode;
    }
    
    return lines;
  }
}

// Use in extension
pi.on("session_start", (_event, ctx) => {
  ctx.ui.setEditorComponent((tui, theme, kb) => new ModalEditor(tui, theme, kb));
});
```

---

## Dialog Helpers

### Confirm Dialog

```typescript
const ok = await ctx.ui.confirm(
  "Confirm Action",
  "Are you sure you want to proceed?",
  {
    timeout: 5000,  // Auto-cancel after 5s
    signal: abortController.signal
  }
);

if (ok) {
  // User confirmed
} else {
  // User cancelled or timed out
}
```

### Select Dialog

```typescript
const choice = await ctx.ui.select(
  "Choose an option",
  ["Option A", "Option B", "Option C"],
  {
    timeout: 10000
  }
);

if (choice) {
  ctx.ui.notify(`Selected: ${choice}`, "info");
}
```

### Input Dialog

```typescript
const value = await ctx.ui.input(
  "Enter your name",
  "Type something..."  // Placeholder
);

if (value) {
  ctx.ui.notify(`Hello, ${value}!`, "info");
}
```

### Editor Dialog

```typescript
const text = await ctx.ui.editor(
  "Edit your response",
  "Initial text\nLine 2"  // Initial content
);

if (text !== undefined) {  // undefined = cancelled
  ctx.ui.notify(`You wrote ${text.split("\n").length} lines`, "info");
}
```

---

## UI Methods Reference

```typescript
// Notifications
ctx.ui.notify(message, type);  // type: "info" | "success" | "warning" | "error"

// Status bar
ctx.ui.setStatus(id, text);  // id: unique identifier
ctx.ui.setStatus("turn", `Turn ${n}...`);

// Footer widget
ctx.ui.setWidget(id, lines, { placement: "aboveEditor" | "belowEditor" });

// Header
ctx.ui.setHeader(lines);

// Title
ctx.ui.setTitle("My Title");

// Theme
ctx.ui.setTheme("dark" | "light");

// Editor
ctx.ui.setEditorText(text);
ctx.ui.setEditorComponent(factory);

// Hidden thinking label
ctx.ui.setHiddenThinkingLabel("Custom label...");

// Custom component
const result = await ctx.ui.custom(factory, options);

// Dialogs
const ok = await ctx.ui.confirm(title, message, options);
const choice = await ctx.ui.select(title, items, options);
const value = await ctx.ui.input(title, placeholder, options);
const text = await ctx.ui.editor(title, initial, options);
```

---

## Theming

### Theme Colors

```typescript
// Foreground
theme.fg("accent", "text");
theme.fg("success", "✓ Done");
theme.fg("error", "Error!");
theme.fg("warning", "Warning");
theme.fg("muted", "Secondary text");
theme.fg("dim", "Tertiary text");

// Background
theme.bg("selectedBg", "text");
theme.bg("toolPendingBg", "Running...");
theme.bg("customMessageBg", "Custom message");

// Combined
const styled = theme.bg("selectedBg", theme.fg("accent", "text"));
```

### Color Tokens

| Category | Tokens |
|----------|--------|
| General | `text`, `accent`, `muted`, `dim` |
| Status | `success`, `error`, `warning` |
| Borders | `border`, `borderAccent`, `borderMuted` |
| Messages | `userMessageText`, `customMessageText`, `customMessageLabel` |
| Tools | `toolTitle`, `toolOutput`, `toolPendingBg`, `toolSuccessBg`, `toolErrorBg` |
| Markdown | `mdHeading`, `mdLink`, `mdCode`, `mdCodeBlockBorder`, etc. |
| Thinking | `thinkingOff`, `thinkingMinimal`, `thinkingLow`, etc. |

---

## Keyboard Handling

```typescript
import { matchesKey, Key } from "@mariozechner/pi-tui";

handleInput(data: string) {
  // Basic keys
  if (matchesKey(data, Key.enter)) { /* ... */ }
  if (matchesKey(data, Key.escape)) { /* ... */ }
  if (matchesKey(data, Key.tab)) { /* ... */ }
  if (matchesKey(data, Key.space)) { /* ... */ }
  if (matchesKey(data, Key.backspace)) { /* ... */ }
  if (matchesKey(data, Key.delete)) { /* ... */ }
  
  // Arrow keys
  if (matchesKey(data, Key.up)) { /* ... */ }
  if (matchesKey(data, Key.down)) { /* ... */ }
  if (matchesKey(data, Key.left)) { /* ... */ }
  if (matchesKey(data, Key.right)) { /* ... */ }
  
  // With modifiers
  if (matchesKey(data, Key.ctrl("c"))) { /* Ctrl+C */ }
  if (matchesKey(data, Key.ctrl("d"))) { /* Ctrl+D */ }
  if (matchesKey(data, Key.shift("tab"))) { /* Shift+Tab */ }
  if (matchesKey(data, Key.alt("left"))) { /* Alt+Left */ }
  if (matchesKey(data, Key.ctrlShift("p"))) { /* Ctrl+Shift+P */ }
  
  // String literals also work
  if (matchesKey(data, "enter")) { /* ... */ }
  if (matchesKey(data, "ctrl+c")) { /* ... */ }
}
```

---

## Text Utilities

```typescript
import { visibleWidth, truncateToWidth, wrapTextWithAnsi } from "@mariozechner/pi-tui";

// Get display width (ignores ANSI codes)
const width = visibleWidth("\x1b[31mRed text\x1b[0m");  // Returns 8, not 20

// Truncate to width
const truncated = truncateToWidth("Long text here", 10);  // "Long text..."
const truncated = truncateToWidth("Long text here", 10, "…");  // "Long text…"

// Word wrap preserving ANSI
const wrapped = wrapTextWithAnsi("Long line with \x1b[31mcolor\x1b[0m", 40);
```

---

## Real-time Rendering (Games/Animations)

```typescript
class GameComponent {
  private animationFrame: number | null = null;
  private version = 0;
  
  constructor(private tui: TUI) {
    this.gameLoop();
  }
  
  private gameLoop() {
    if (!this.gameOver) {
      this.tick();  // Update game state
      this.version++;
      this.tui.requestRender();
      this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }
  }
  
  render(width: number): string[] {
    if (this.cachedVersion === this.version) {
      return this.cachedLines;
    }
    
    // Render game frame
    this.cachedLines = this.renderFrame(width);
    this.cachedWidth = width;
    this.cachedVersion = this.version;
    return this.cachedLines;
  }
  
  invalidate() {
    this.cachedVersion = -1;
  }
  
  dispose() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }
}
```

---

## Common UI Patterns

### Loading Spinner

```typescript
import { BorderedLoader } from "@mariozechner/pi-coding-agent";

const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
  const loader = new BorderedLoader(tui, theme, "Processing...");
  loader.onAbort = () => done(null);
  
  // Do async work
  doWork().then(done).catch(() => done(null));
  
  return loader;
});
```

### Tabbed Interface

```typescript
class TabbedComponent {
  private tabs: string[];
  private activeTab = 0;
  
  render(width: number): string[] {
    const lines: string[] = [];
    
    // Tab bar
    const tabBar = this.tabs.map((tab, i) => {
      const isActive = i === this.activeTab;
      return isActive ? `[${tab}]` : ` ${tab} `;
    }).join(" ");
    
    lines.push(tabBar);
    lines.push("");
    
    // Tab content
    lines.push(...this.renderTabContent(this.tabs[this.activeTab], width));
    
    return lines;
  }
  
  handleInput(data: string) {
    if (matchesKey(data, Key.tab) || matchesKey(data, Key.right)) {
      this.activeTab = (this.activeTab + 1) % this.tabs.length;
      this.invalidate();
    }
    if (matchesKey(data, Key.shift("tab")) || matchesKey(data, Key.left)) {
      this.activeTab = (this.activeTab - 1 + this.tabs.length) % this.tabs.length;
      this.invalidate();
    }
  }
}
```

---

## Debugging UI

### Log Render Calls

```typescript
render(width: number): string[] {
  console.log("[MyComponent] render:", { width, state: this.state });
  return this.cachedLines;
}
```

### Enable TUI Logging

```bash
PI_TUI_WRITE_LOG=/tmp/tui-ansi.log pi
```

Captures raw ANSI stream for debugging.

---

**Next Steps**:
- Read [PI-DEV-ADVANCED.md](./PI-DEV-ADVANCED.md) for games, overlays, animations
- Browse `$PI_CODING_AGENT_PACKAGE/examples/extensions/` for UI examples
- Check `$PI_CODING_AGENT_PACKAGE/node_modules/@mariozechner/pi-tui/dist/index.js` for component types

