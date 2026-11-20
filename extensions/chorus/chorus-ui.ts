import type { ExtensionCommandContext, KeybindingsManager } from '@earendil-works/pi-coding-agent';
import { CustomEditor, DynamicBorder, type ExtensionAPI } from '@earendil-works/pi-coding-agent';
import {
  Box,
  type Component,
  Container,
  type EditorTheme,
  Key,
  matchesKey,
  Spacer,
  Text,
  type TUI,
  truncateToWidth,
  visibleWidth,
  wrapTextWithAnsi,
} from '@earendil-works/pi-tui';
import {
  createTattlerPendingBatchDetails,
  createTattlerPendingBatchMessageFromMessages,
  TATTLER_PENDING_BATCH_ENTRY_TYPE,
  type TattlerPendingBatchDetails,
  type TattlerPendingChorusMessage,
} from '../tattler/tattler-inbox';
import { requestChorusRoomPost } from '../tattler/tattler-pi-events';
import type { ChorusRoomId, TattlerIdentityV0 } from '../tattler/tattler-protocol';
import type { ChorusIncomingMessageDetails, ChorusRoomBroker, ChorusTranscriptEntry } from './chorus-runtime';

// Data retention bound: how many recent entries the transcript keeps as render candidates.
// The actual on-screen height is a SEPARATE, smaller bound -- see CHORUS_ROOM_LINE_BUDGET_CAP
// and computeChorusTranscriptLineBudget below -- so dropping this number just means fewer
// candidates for that budget to work with. Don't re-merge the two concerns.
const CHORUS_TRANSCRIPT_ENTRY_LIMIT = 12;
const LITERAL_SLASH_PREFIX = '//';
const CHORUS_TRANSCRIPT_ENTRY_LINE_LIMIT = 4;

// In fullscreen TUI mode the aboveEditor widget sits in a sticky dock (widget + editor +
// footer + status) that is a flex sibling of the scrollable chat transcript with grow:0 --
// it never yields space back. The transcript's basis:0 disqualifies it from the shrink pass
// once it hits its 1-row minSize, so the *entire* deficit lands on the dock until its natural
// height crosses terminalRows-1, at which point the transcript collapses to exactly 1 row in
// a single step, not a graceful shrink (AGENT-256). This budget keeps the widget's own
// contribution well clear of that threshold: a flat 30 lines on terminals roomy enough to
// afford it, scaling down on shorter terminals (reserving ~12 rows for editor/footer/status
// overhead) so a 24-row terminal -- a common default, not an absurd edge case -- still leaves
// the transcript alive instead of reproducing the exact collapse this exists to prevent.
// Applied in both TUI modes (not just fullscreen): a fixed line budget is harmless in regular
// mode (native scrollback already handles unbounded content) and it also stops the widget's
// height from jittering with every arrival once the budget is reached, which entry-count
// clamping could never do.
const CHORUS_ROOM_LINE_BUDGET_CAP = 30;
const CHORUS_ROOM_DOCK_RESERVED_ROWS = 12;

export function computeChorusTranscriptLineBudget(terminalRows: number): number {
  return Math.max(1, Math.min(CHORUS_ROOM_LINE_BUDGET_CAP, terminalRows - CHORUS_ROOM_DOCK_RESERVED_ROWS));
}

// Renders entries newest-first against a rendered-line budget, dropping the OLDEST entries
// once including another would exceed it. The most recent entry always renders even if it
// alone exceeds the budget (each entry is already capped at CHORUS_TRANSCRIPT_ENTRY_LINE_LIMIT
// lines, so the overshoot is small and bounded) -- there is no narrower fallback below "show
// the latest message". No truncation indicator: Doug didn't ask for one, and a line budget
// alone already fixes the jitter and starvation this exists to prevent.
export function selectTranscriptLinesWithinBudget(
  entries: readonly ChorusTranscriptEntry[],
  width: number,
  theme: ThemeLike,
  lineBudget: number,
): string[] {
  if (entries.length === 0) {
    return [];
  }

  const includedBlocks: string[][] = [];
  let usedLines = 0;
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index];
    if (entry === undefined) continue;
    const entryLines = formatChorusTranscriptEntryLines(entry, width, theme);
    if (includedBlocks.length > 0 && usedLines + entryLines.length > lineBudget) {
      break;
    }
    includedBlocks.unshift(entryLines);
    usedLines += entryLines.length;
  }

  return includedBlocks.flat();
}
// ToolRenderResultOptions (unlike MessageRenderOptions) does not expose outputPad as of
// Pi 0.84.0, so tool renderResult callbacks have no way to read the user's actual setting --
// fall back to Pi's own documented default (docs/settings.md: outputPad defaults to 1). A
// natural candidate for an upstream ask alongside AGENT-245.
export const DEFAULT_OUTPUT_PAD = 1;

interface ThemeLike {
  fg(color: 'accent' | 'dim' | 'muted' | 'success', text: string): string;
  bg(color: 'customMessageBg' | 'toolSuccessBg', text: string): string;
  bold(text: string): string;
}

interface SendChorusMessageOptions {
  readonly triggerTurn?: boolean;
  readonly modelVisible?: boolean;
}

type ChorusEditorSubmission =
  | { readonly kind: 'empty' }
  | { readonly kind: 'room'; readonly message: string }
  | { readonly kind: 'app-command'; readonly command: string };

export function parseChorusEditorSubmission(rawText: string): ChorusEditorSubmission {
  const text = rawText.trim();
  if (text.length === 0) {
    return { kind: 'empty' };
  }

  if (text.startsWith(LITERAL_SLASH_PREFIX)) {
    const message = text.slice(1).trim();
    return message.length === 0 ? { kind: 'empty' } : { kind: 'room', message };
  }

  if (text.startsWith('/')) {
    return { kind: 'app-command', command: text };
  }

  return { kind: 'room', message: text };
}

class PeerPicker implements Component {
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
      this.onConfirm?.(this.items.filter((item) => item.checked).map((item) => item.peer));
      return;
    } else if (matchesKey(data, Key.escape)) {
      this.onCancel?.();
      return;
    }
    this.invalidate();
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;
    this.cachedLines = this.items.map((item, index) => {
      const mark = item.checked ? '◉' : '○';
      const arrow = index === this.cursor ? '▶' : ' ';
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

function wrapTranscriptLine(prefix: string, content: string, width: number): string[] {
  const contentWidth = width - visibleWidth(prefix);
  if (prefix.length > 0 && contentWidth < 8) {
    return [
      truncateToWidth(prefix.trimEnd(), width),
      ...wrapTextWithAnsi(content, width).map((line) => truncateToWidth(line, width)),
    ];
  }

  return wrapTextWithAnsi(`${prefix}${content}`, width).map((line) => truncateToWidth(line, width));
}

function capTranscriptEntryLines(lines: string[], width: number, theme: ThemeLike): string[] {
  if (lines.length <= CHORUS_TRANSCRIPT_ENTRY_LINE_LIMIT) {
    return lines;
  }

  const visibleLines = lines.slice(0, CHORUS_TRANSCRIPT_ENTRY_LINE_LIMIT - 1);
  const hiddenLineCount = lines.length - visibleLines.length;
  visibleLines.push(
    truncateToWidth(theme.fg('dim', `… ${hiddenLineCount} more line${hiddenLineCount === 1 ? '' : 's'}`), width),
  );
  return visibleLines;
}

export function formatChorusTranscriptEntryLines(
  entry: ChorusTranscriptEntry,
  width: number,
  theme: ThemeLike,
): string[] {
  const tagColor = entry.self ? 'success' : 'accent';
  const tag = theme.fg(tagColor, `[${entry.from}]`);
  const status = entry.self ? theme.fg('dim', ` ${entry.status}`) : '';
  const firstPrefix = `${tag}${status} `;
  const renderedLines = entry.message.split(/\r?\n/).flatMap((line, index) => {
    const content = line.length === 0 ? theme.fg('dim', '␤') : line;
    return wrapTranscriptLine(index === 0 ? firstPrefix : '', content, width);
  });

  return capTranscriptEntryLines(renderedLines, width, theme);
}

// Narrow slice of TUI that ChorusRoomTranscript needs for line-budgeting -- deliberately
// not the full TUI type, so the render-time-not-construction-time read (see render() below)
// is obvious from the shape alone and the component stays trivially testable with a fake.
export interface ChorusRoomViewport {
  readonly terminal: { readonly rows: number };
}

class ChorusRoomTranscript implements Component {
  constructor(
    private readonly viewport: ChorusRoomViewport,
    private readonly broker: ChorusRoomBroker,
    private readonly peers: readonly TattlerIdentityV0[],
    private readonly theme: ThemeLike,
  ) {}

  render(width: number): string[] {
    const lines = [
      this.theme.fg(
        'accent',
        `◉ Chorus #${this.broker.roomId} as ${this.broker.localAuthorName} (${this.peers.length} peer${this.peers.length === 1 ? '' : 's'})`,
      ),
    ];

    const entries = this.broker.entries.slice(-CHORUS_TRANSCRIPT_ENTRY_LIMIT);
    if (entries.length === 0) {
      lines.push(this.theme.fg('dim', 'No room messages yet. Type below and press enter to post to the room.'));
      return lines.map((line) => truncateToWidth(line, width));
    }

    // Read terminal rows fresh on every render -- fullscreen is runtime-toggleable and the
    // terminal can resize between frames, so a value captured once in the constructor would
    // go stale and let the exact starvation/jitter this budget exists to prevent creep back.
    const lineBudget = computeChorusTranscriptLineBudget(this.viewport.terminal.rows);
    lines.push(...selectTranscriptLinesWithinBudget(entries, width, this.theme, lineBudget));

    return lines;
  }

  invalidate(): void {}
}

class ChorusRoomEditor extends CustomEditor {
  constructor(
    tui: TUI,
    theme: EditorTheme,
    keybindings: KeybindingsManager,
    private readonly pi: ExtensionAPI,
    private readonly room: ChorusRoomId,
    private readonly notify: (message: string, type?: 'info' | 'warning' | 'error') => void,
  ) {
    super(tui, theme, keybindings);
  }

  override handleInput(data: string): void {
    if (matchesKey(data, Key.enter) && !this.disableSubmit) {
      const text = this.getExpandedText();
      const submission = parseChorusEditorSubmission(text);
      if (submission.kind === 'empty') return;
      if (submission.kind === 'app-command') {
        this.setText('');
        void this.onSubmit?.(submission.command);
        return;
      }

      this.addToHistory(text.trim());
      this.setText('');

      void requestChorusRoomPost(this.pi, { roomId: this.room, message: submission.message }).catch((err: unknown) => {
        this.notify(
          `Chorus: failed to post room message — ${err instanceof Error ? err.message : String(err)}`,
          'error',
        );
      });
      return;
    }

    super.handleInput(data);
  }

  override render(width: number): string[] {
    // Pi's TUI contract treats render output as read-only (built-in components may cache it), so
    // copy before writing the room label.
    const lines = [...super.render(width)];
    const label = ` #${this.room} · /agent · // `;
    const last = lines.length - 1;
    const lastLine = lines[last];
    if (lastLine === undefined) return lines;
    lines[last] = truncateToWidth(lastLine, Math.max(0, width - label.length), '') + label;
    return lines;
  }
}

export function createChorusMessageComponent(
  details: ChorusIncomingMessageDetails,
  theme: ThemeLike,
  outputPad: number,
): Component {
  const room = ` #${details.roomId}`;
  const tagColor = details.self ? 'success' : 'accent';
  const backgroundColor = details.self ? 'toolSuccessBg' : 'customMessageBg';
  const status = details.status ? theme.fg('dim', ` ${details.status}`) : '';
  const badge = `${theme.bold(theme.fg(tagColor, `[${details.from}]`))}${status}${theme.fg('muted', room)}`;
  const box = new Box(outputPad, 1, (text) => theme.bg(backgroundColor, text));
  box.addChild(new Text(`${badge}\n${details.message}`, 0, 0));
  return box;
}

export function sendChorusMessageToChat(
  pi: ExtensionAPI,
  details: ChorusIncomingMessageDetails,
  options: SendChorusMessageOptions = {},
): void {
  const pendingMessage = createPendingChorusMessage(details);

  // modelVisible: false is display-only (always paired with self-authored echoes, which
  // are also always triggerTurn: false -- see the three chorus.ts call sites). Route
  // through appendEntry so it structurally never participates in LLM context, instead of
  // faking non-participation with an empty sendMessage content string.
  if (options.modelVisible === false) {
    pi.appendEntry<TattlerPendingBatchDetails>(
      TATTLER_PENDING_BATCH_ENTRY_TYPE,
      createTattlerPendingBatchDetails([pendingMessage]),
    );
    return;
  }

  pi.sendMessage(createTattlerPendingBatchMessageFromMessages([pendingMessage]), {
    triggerTurn: options.triggerTurn ?? true,
    deliverAs: 'steer',
  });
}

function createPendingChorusMessage(details: ChorusIncomingMessageDetails): TattlerPendingChorusMessage {
  return {
    kind: 'chorus.room-message.v0',
    id: details.postId,
    roomId: details.roomId,
    from: details.from,
    message: details.message,
    postId: details.postId,
    broker: details.broker,
    self: details.self,
    visible: true,
  };
}

export interface ChorusRoomUiOptions {
  readonly pi: ExtensionAPI;
  readonly ctx: ExtensionCommandContext;
  readonly room: ChorusRoomId;
  readonly broker: ChorusRoomBroker;
  readonly peers: readonly TattlerIdentityV0[];
  readonly onRenderReady: (requestRender: () => void) => void;
}

export function setChorusRoomUi(options: ChorusRoomUiOptions): void {
  const { pi, ctx, room, broker, peers, onRenderReady } = options;
  ctx.ui.setWidget(
    'chorus-room',
    (tui, theme) => {
      onRenderReady(() => tui.requestRender());
      return new ChorusRoomTranscript(tui, broker, peers, theme as ThemeLike);
    },
    { placement: 'aboveEditor' },
  );
  ctx.ui.setEditorComponent(
    (tui, theme, keybindings) => new ChorusRoomEditor(tui, theme, keybindings, pi, room, ctx.ui.notify),
  );
  ctx.ui.setStatus('chorus', ctx.ui.theme.fg('accent', `◉ chorus #${room} (${peers.length})`));
}

export function clearChorusRoomUi(ctx: ExtensionCommandContext): void {
  ctx.ui.setEditorComponent(undefined);
  ctx.ui.setWidget('chorus-room', undefined);
  ctx.ui.setStatus('chorus', undefined);
}

export async function choosePeers(
  ctx: ExtensionCommandContext,
  peers: TattlerIdentityV0[],
): Promise<TattlerIdentityV0[] | undefined> {
  return await ctx.ui.custom<TattlerIdentityV0[] | undefined>(
    (tui, theme, _kb, done) => {
      const container = new Container();
      container.addChild(new DynamicBorder((text: string) => theme.fg('accent', text)));
      container.addChild(new Text(theme.fg('accent', theme.bold('Chorus — select room peers')), 1, 0));
      container.addChild(new Spacer(1));

      const picker = new PeerPicker(peers);
      picker.onConfirm = (selected) => done(selected.length > 0 ? selected : undefined);
      picker.onCancel = () => done(undefined);
      container.addChild(picker);

      container.addChild(new Spacer(1));
      container.addChild(
        new Text(theme.fg('dim', '↑↓ navigate  ·  space toggle  ·  enter confirm  ·  esc cancel'), 1, 0),
      );
      container.addChild(new DynamicBorder((text: string) => theme.fg('accent', text)));

      return {
        render: (width) => container.render(width),
        invalidate: () => container.invalidate(),
        handleInput: (data) => {
          picker.handleInput(data);
          tui.requestRender();
        },
      };
    },
    { overlay: true },
  );
}
