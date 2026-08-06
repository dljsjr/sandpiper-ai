import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { Component } from '@earendil-works/pi-tui';
import { truncateToWidth, visibleWidth, wrapTextWithAnsi } from '@earendil-works/pi-tui';
import {
  TATTLER_PENDING_BATCH_CUSTOM_TYPE,
  TATTLER_PENDING_BATCH_ENTRY_TYPE,
  type TattlerPendingBatchDetails,
  type TattlerPendingChorusMessage,
  type TattlerPendingMessage,
} from './tattler-inbox';

interface ThemeLike {
  fg(color: 'accent' | 'muted' | 'success', text: string): string;
  bg(color: 'customMessageBg' | 'toolSuccessBg', text: string): string;
  bold(text: string): string;
}

const emptyComponent: Component = {
  render: () => [],
  invalidate: () => undefined,
};

// EntryRenderOptions (unlike MessageRenderOptions) does not expose outputPad as of Pi
// 0.84.0, so the entry-renderer path below has no way to read the user's actual setting --
// fall back to Pi's own documented default (docs/settings.md: outputPad defaults to 1).
// A natural candidate for an upstream ask alongside AGENT-245.
const DEFAULT_OUTPUT_PAD = 1;

class TattlerPendingBatchComponent implements Component {
  constructor(
    private readonly details: TattlerPendingBatchDetails,
    private readonly theme: ThemeLike,
    private readonly outputPad: number,
  ) {}

  render(width: number): string[] {
    const visibleMessages = this.details.messages.filter(isVisibleChorusMessage);
    return visibleMessages.flatMap((message, index) => {
      const lines = renderChorusMessage(message, width, this.theme, this.outputPad);
      return index === 0 ? lines : ['', ...lines];
    });
  }

  invalidate(): void {}
}

function componentForBatchDetails(
  details: TattlerPendingBatchDetails | undefined,
  theme: ThemeLike,
  outputPad: number,
): Component {
  if (details?.kind !== 'batch' || !Array.isArray(details.messages)) {
    return emptyComponent;
  }

  return new TattlerPendingBatchComponent(details, theme, outputPad);
}

// Registers renderers for BOTH the legacy message-based batch (TATTLER_PENDING_BATCH_CUSTOM_TYPE,
// still emitted for every model-visible batch) and the display-only entry-based batch
// (TATTLER_PENDING_BATCH_ENTRY_TYPE, used for model-invisible batches like chorus self-echoes).
// Keep both registered permanently, not just during a migration window -- old session files
// with legacy custom_message-shaped batches are a persistent population, not a transient one.
export function registerTattlerPendingBatchRenderer(
  pi: Pick<ExtensionAPI, 'registerEntryRenderer' | 'registerMessageRenderer'>,
): void {
  pi.registerMessageRenderer<TattlerPendingBatchDetails>(TATTLER_PENDING_BATCH_CUSTOM_TYPE, (message, options, theme) =>
    componentForBatchDetails(message.details, theme as ThemeLike, options.outputPad),
  );

  pi.registerEntryRenderer<TattlerPendingBatchDetails>(TATTLER_PENDING_BATCH_ENTRY_TYPE, (entry, _options, theme) =>
    componentForBatchDetails(entry.data, theme as ThemeLike, DEFAULT_OUTPUT_PAD),
  );
}

function isVisibleChorusMessage(message: TattlerPendingMessage): message is TattlerPendingChorusMessage {
  return message.kind === 'chorus.room-message.v0' && message.visible;
}

function renderChorusMessage(
  message: TattlerPendingChorusMessage,
  width: number,
  theme: ThemeLike,
  outputPad: number,
): string[] {
  const tagColor = message.self ? 'success' : 'accent';
  const backgroundColor = message.self ? 'toolSuccessBg' : 'customMessageBg';
  const badge = `${theme.bold(theme.fg(tagColor, `[${message.from}]`))}${theme.fg('muted', ` #${message.roomId}`)}`;
  const contentWidth = Math.max(0, width - outputPad * 2);
  const messageLines = message.message.split(/\r?\n/).flatMap((line) => {
    const text = line.length === 0 ? '␤' : line;
    return wrapTextWithAnsi(text, contentWidth).map((wrapped) => truncateToWidth(wrapped, contentWidth));
  });

  const blankLine = theme.bg(backgroundColor, ' '.repeat(Math.max(0, width)));
  const contentLines = [truncateToWidth(badge, contentWidth), ...messageLines].map((line) =>
    theme.bg(backgroundColor, padContentLineToWidth(line, width, outputPad)),
  );

  return [blankLine, ...contentLines, blankLine];
}

function padContentLineToWidth(line: string, width: number, outputPad: number): string {
  if (width <= 0) {
    return '';
  }

  const rightPadding = Math.max(outputPad, width - visibleWidth(line) - outputPad);
  return `${' '.repeat(outputPad)}${line}${' '.repeat(rightPadding)}`;
}
