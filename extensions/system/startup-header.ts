import {
  type AppKeybinding,
  type ExtensionAPI,
  keyHint,
  keyText,
  rawKeyHint,
  type Theme,
  VERSION,
} from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';

// Pi's built-in header shows Pi's logo next to the version; Sandpiper keeps the same key hints
// under its own name. The hint lists follow Pi's built-in header in interactive-mode.
function compactHints(theme: Theme): string {
  const hint = (keybinding: AppKeybinding, description: string) => keyHint(keybinding, description);
  return [
    hint('app.interrupt', 'interrupt'),
    rawKeyHint(`${keyText('app.clear')}/${keyText('app.exit')}`, 'clear/exit'),
    rawKeyHint('/', 'commands'),
    rawKeyHint('!', 'bash'),
    hint('app.tools.expand', 'more'),
  ].join(theme.fg('muted', ' · '));
}

function expandedHints(): string {
  const hint = (keybinding: AppKeybinding, description: string) => keyHint(keybinding, description);
  return [
    hint('app.interrupt', 'to interrupt'),
    hint('app.clear', 'to clear'),
    rawKeyHint(`${keyText('app.clear')} twice`, 'to exit'),
    hint('app.exit', 'to exit (empty)'),
    hint('app.suspend', 'to suspend'),
    keyHint('tui.editor.deleteToLineEnd', 'to delete to end'),
    hint('app.thinking.cycle', 'to cycle thinking level'),
    rawKeyHint(`${keyText('app.model.cycleForward')}/${keyText('app.model.cycleBackward')}`, 'to cycle models'),
    hint('app.model.select', 'to select model'),
    hint('app.tools.expand', 'to expand tools'),
    hint('app.thinking.toggle', 'to expand thinking'),
    hint('app.editor.external', 'for external editor'),
    rawKeyHint('/', 'for commands'),
    rawKeyHint('!', 'to run bash'),
    rawKeyHint('!!', 'to run bash (no context)'),
    hint('app.message.followUp', 'to queue follow-up'),
    hint('app.message.dequeue', 'to edit all queued messages'),
    hint('app.clipboard.pasteImage', 'to paste files on macOS, images, or text'),
    rawKeyHint('drop files', 'to attach'),
  ].join('\n');
}

/** Pi expands the header together with tool output, through setExpanded(). */
export class SandpiperHeader extends Text {
  private expanded = false;

  constructor(
    private readonly theme: Theme,
    private readonly version: string = VERSION,
  ) {
    super('', 1, 0);
    this.refresh();
  }

  setExpanded(expanded: boolean): void {
    this.expanded = expanded;
    this.refresh();
  }

  private refresh(): void {
    const title = `${this.theme.bold(this.theme.fg('accent', 'sandpiper'))} ${this.theme.fg('dim', `v${this.version}`)}`;
    this.setText(`${title}\n${this.expanded ? expandedHints() : compactHints(this.theme)}`);
  }
}

export function registerStartupHeader(pi: ExtensionAPI): void {
  pi.on('session_start', (_event, ctx) => {
    if (ctx.mode !== 'tui') return;
    ctx.ui.setHeader((_tui, theme) => new SandpiperHeader(theme));
  });
}
