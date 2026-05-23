// Chorus — multi-agent broadcast editor extension.
// Submits the current prompt to the local agent AND a selected set of live
// Tattler peers simultaneously.
//
// /chorus  — toggle broadcast mode (opens peer picker when enabling).
// Footer indicator: "◉ chorus (N peers)" while active.

import type { KeybindingsManager } from '@earendil-works/pi-coding-agent';
import { CustomEditor, DynamicBorder, type ExtensionAPI } from '@earendil-works/pi-coding-agent';
import {
  Container,
  type EditorTheme,
  Key,
  matchesKey,
  Spacer,
  Text,
  type TUI,
  truncateToWidth,
} from '@earendil-works/pi-tui';
import { requestListPeers, requestOwnIdentity } from './tattler/tattler-pi-events';
import type { TattlerIdentityV0 } from './tattler/tattler-protocol';

// ── Protocol surface ──────────────────────────────────────────────────────────
// Intentionally red until tattler-protocol.ts is extracted from tattler.ts.
// Required exports:
//   export function sendUserPrompt(peer: TattlerIdentityV0, prompt: string, from: string): Promise<void>

// stubs until we're done implementing the new wire type
declare function sendUserPrompt(peer: TattlerIdentityV0, prompt: string, from: string): Promise<void>;

// ── Peer multi-select component ───────────────────────────────────────────────

class PeerPicker {
  private items: Array<{ peer: TattlerIdentityV0; checked: boolean }>;
  private cursor = 0;
  private cachedWidth?: number;
  private cachedLines?: string[];

  onConfirm?: (selected: TattlerIdentityV0[]) => void;
  onCancel?: () => void;

  constructor(peers: TattlerIdentityV0[]) {
    this.items = peers.map((peer) => ({ peer, checked: false }));
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.up)) {
      this.cursor = Math.max(0, this.cursor - 1);
    } else if (matchesKey(data, Key.down)) {
      this.cursor = Math.min(this.items.length - 1, this.cursor + 1);
    } else if (matchesKey(data, Key.space)) {
      const item = this.items[this.cursor];
      if (item) item.checked = !item.checked;
    } else if (matchesKey(data, Key.enter)) {
      this.onConfirm?.(this.items.filter((i) => i.checked).map((i) => i.peer));
      return;
    } else if (matchesKey(data, Key.escape)) {
      this.onCancel?.();
      return;
    }
    this.invalidate();
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;
    this.cachedLines = this.items.map((item, i) => {
      const mark = item.checked ? '◉' : '○';
      const arrow = i === this.cursor ? '▶' : ' ';
      return truncateToWidth(`${arrow} ${mark} ${item.peer.name}`, width);
    });
    this.cachedWidth = width;
    return this.cachedLines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}

// ── Broadcast editor ──────────────────────────────────────────────────────────

class BroadcastEditor extends CustomEditor {
  private peers: TattlerIdentityV0[] = [];
  private ownName: string;

  constructor(tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager, ownName: string) {
    super(tui, theme, keybindings);
    this.ownName = ownName;
  }

  setPeers(peers: TattlerIdentityV0[]): void {
    this.peers = [...peers];
  }

  override handleInput(data: string): void {
    if (matchesKey(data, Key.enter) && !this.disableSubmit && this.peers.length > 0) {
      const prompt = this.getText();
      if (prompt.trim().length > 0) {
        for (const peer of this.peers) {
          sendUserPrompt(peer, prompt, this.ownName).catch(() => {});
        }
      }
    }
    super.handleInput(data);
  }

  override render(width: number): string[] {
    const lines = super.render(width);
    if (lines.length === 0 || this.peers.length === 0) return lines;
    const label = ` ◉ chorus (${this.peers.length}) `;
    const last = lines.length - 1;
    const lastLine = lines[last];
    if (lastLine === undefined) return lines;
    lines[last] = truncateToWidth(lastLine, width - label.length, '') + label;
    return lines;
  }
}

// ── Extension state ───────────────────────────────────────────────────────────

let activePeers: TattlerIdentityV0[] = [];

function isActive(): boolean {
  return activePeers.length > 0;
}

// ── Extension factory ─────────────────────────────────────────────────────────

export default async function (pi: ExtensionAPI) {
  pi.registerCommand('chorus', {
    description: 'Toggle multi-agent broadcast mode (opens peer picker when enabling)',
    handler: async (_args, ctx) => {
      if (isActive()) {
        activePeers = [];
        ctx.ui.setEditorComponent(undefined);
        ctx.ui.setStatus('chorus', undefined);
        ctx.ui.notify('Chorus: broadcast disabled', 'info');
        return;
      }

      let ownIdentity: TattlerIdentityV0;
      let peers: TattlerIdentityV0[];
      try {
        [ownIdentity, peers] = await Promise.all([requestOwnIdentity(pi), requestListPeers(pi)]);
      } catch {
        ctx.ui.notify('Chorus: Tattler identity or peer discovery unavailable', 'error');
        return;
      }

      if (peers.length === 0) {
        ctx.ui.notify('Chorus: no live peers available', 'warning');
        return;
      }

      const selected = await ctx.ui.custom<TattlerIdentityV0[] | null>(
        (tui, theme, _kb, done) => {
          const container = new Container();
          container.addChild(new DynamicBorder((s: string) => theme.fg('accent', s)));
          container.addChild(new Text(theme.fg('accent', theme.bold('Chorus — select broadcast peers')), 1, 0));
          container.addChild(new Spacer(1));

          const picker = new PeerPicker(peers);
          picker.onConfirm = (sel) => done(sel.length > 0 ? sel : null);
          picker.onCancel = () => done(null);
          container.addChild(picker);

          container.addChild(new Spacer(1));
          container.addChild(
            new Text(theme.fg('dim', '↑↓ navigate  ·  space toggle  ·  enter confirm  ·  esc cancel'), 1, 0),
          );
          container.addChild(new DynamicBorder((s: string) => theme.fg('accent', s)));

          return {
            render: (w) => container.render(w),
            invalidate: () => container.invalidate(),
            handleInput: (d) => {
              picker.handleInput(d);
              tui.requestRender();
            },
          };
        },
        { overlay: true },
      );

      if (!selected || selected.length === 0) {
        ctx.ui.notify('Chorus: no peers selected, broadcast not enabled', 'info');
        return;
      }

      activePeers = selected;

      ctx.ui.setEditorComponent((tui, theme, keybindings) => {
        const editor = new BroadcastEditor(tui, theme, keybindings, ownIdentity.name);
        editor.setPeers(activePeers);
        return editor;
      });

      ctx.ui.setStatus('chorus', ctx.ui.theme.fg('accent', `◉ chorus (${activePeers.length} peers)`));
      ctx.ui.notify(`Chorus: broadcasting to ${activePeers.length} peer${activePeers.length === 1 ? '' : 's'}`, 'info');
    },
  });
}
