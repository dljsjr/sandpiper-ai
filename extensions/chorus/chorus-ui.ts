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
} from '@earendil-works/pi-tui';
import { requestChorusRoomPost } from '../tattler/tattler-pi-events';
import type { ChorusRoomId, TattlerIdentityV0 } from '../tattler/tattler-protocol';
import {
  CHORUS_MESSAGE_CUSTOM_TYPE,
  type ChorusIncomingMessageDetails,
  type ChorusRoomBroker,
  createChorusUserMessageContent,
} from './chorus-runtime';

const CHORUS_TRANSCRIPT_ENTRY_LIMIT = 12;
const DIRECT_AGENT_COMMAND = '/agent';
const DIRECT_AGENT_PREFIX = `${DIRECT_AGENT_COMMAND} `;

interface ThemeLike {
  fg(color: 'accent' | 'dim' | 'muted' | 'success', text: string): string;
  bg(color: 'customMessageBg', text: string): string;
  bold(text: string): string;
}

interface SendChorusMessageOptions {
  readonly triggerTurn?: boolean;
  readonly modelVisible?: boolean;
}

type ChorusEditorSubmission =
  | { readonly kind: 'empty' }
  | { readonly kind: 'room'; readonly message: string }
  | { readonly kind: 'local-agent'; readonly message: string };

export function parseChorusEditorSubmission(rawText: string): ChorusEditorSubmission {
  const text = rawText.trim();
  if (text.length === 0) {
    return { kind: 'empty' };
  }

  if (text === DIRECT_AGENT_COMMAND) {
    return { kind: 'empty' };
  }

  if (text.startsWith(DIRECT_AGENT_PREFIX)) {
    const message = text.slice(DIRECT_AGENT_PREFIX.length).trim();
    return message.length === 0 ? { kind: 'empty' } : { kind: 'local-agent', message };
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

class ChorusRoomTranscript implements Component {
  constructor(
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

    for (const entry of entries) {
      const tagColor = entry.self ? 'success' : 'accent';
      const status = entry.self ? this.theme.fg('dim', ` ${entry.status}`) : '';
      lines.push(truncateToWidth(`${this.theme.fg(tagColor, `[${entry.from}]`)}${status} ${entry.message}`, width));
    }

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

      this.addToHistory(text.trim());
      this.setText('');
      if (submission.kind === 'local-agent') {
        this.pi.sendUserMessage(submission.message, { deliverAs: 'steer' });
        this.notify('Chorus: sent direct prompt to local agent', 'info');
        return;
      }

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
    const lines = super.render(width);
    const label = ` #${this.room} · /agent `;
    const last = lines.length - 1;
    const lastLine = lines[last];
    if (lastLine === undefined) return lines;
    lines[last] = truncateToWidth(lastLine, Math.max(0, width - label.length), '') + label;
    return lines;
  }
}

export function registerChorusMessageRenderer(pi: ExtensionAPI): void {
  pi.registerMessageRenderer<ChorusIncomingMessageDetails>(CHORUS_MESSAGE_CUSTOM_TYPE, (message, _options, theme) => {
    const details = message.details;
    const from = details?.from ?? 'unknown';
    const content = details?.message ?? (typeof message.content === 'string' ? message.content : '');
    const room = details?.roomId ? ` #${details.roomId}` : '';
    const badge = `${theme.bold(theme.fg('accent', `[${from}]`))}${theme.fg('muted', room)}`;
    const box = new Box(1, 1, (text) => theme.bg('customMessageBg', text));
    box.addChild(new Text(`${badge}\n${content}`, 0, 0));
    return box;
  });
}

export function sendChorusMessageToChat(
  pi: ExtensionAPI,
  details: ChorusIncomingMessageDetails,
  options: SendChorusMessageOptions = {},
): void {
  pi.sendMessage<ChorusIncomingMessageDetails>(
    {
      customType: CHORUS_MESSAGE_CUSTOM_TYPE,
      content: (options.modelVisible ?? true) ? createChorusUserMessageContent(details) : '',
      display: true,
      details,
    },
    { triggerTurn: options.triggerTurn ?? true, deliverAs: 'steer' },
  );
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
      return new ChorusRoomTranscript(broker, peers, theme as ThemeLike);
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
