import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { Component } from '@earendil-works/pi-tui';
import { truncateToWidth, wrapTextWithAnsi } from '@earendil-works/pi-tui';
import {
  TATTLER_PENDING_BATCH_CUSTOM_TYPE,
  type TattlerPendingBatchDetails,
  type TattlerPendingChorusMessage,
  type TattlerPendingMessage,
} from './tattler-inbox';

interface ThemeLike {
  fg(color: 'accent' | 'muted', text: string): string;
  bold(text: string): string;
}

const emptyComponent: Component = {
  render: () => [],
  invalidate: () => undefined,
};

class TattlerPendingBatchComponent implements Component {
  constructor(
    private readonly details: TattlerPendingBatchDetails,
    private readonly theme: ThemeLike,
  ) {}

  render(width: number): string[] {
    const visibleMessages = this.details.messages.filter(isVisibleChorusMessage);
    return visibleMessages.flatMap((message, index) => {
      const lines = renderChorusMessage(message, width, this.theme);
      return index === 0 ? lines : ['', ...lines];
    });
  }

  invalidate(): void {}
}

export function registerTattlerPendingBatchRenderer(pi: Pick<ExtensionAPI, 'registerMessageRenderer'>): void {
  pi.registerMessageRenderer<TattlerPendingBatchDetails>(
    TATTLER_PENDING_BATCH_CUSTOM_TYPE,
    (message, _options, theme) => {
      const details = message.details;
      if (details?.kind !== 'batch' || !Array.isArray(details.messages)) {
        return emptyComponent;
      }

      return new TattlerPendingBatchComponent(details, theme as ThemeLike);
    },
  );
}

function isVisibleChorusMessage(message: TattlerPendingMessage): message is TattlerPendingChorusMessage {
  return message.kind === 'chorus.room-message.v0' && message.visible;
}

function renderChorusMessage(message: TattlerPendingChorusMessage, width: number, theme: ThemeLike): string[] {
  const badge = `${theme.bold(theme.fg('accent', `[${message.from}]`))}${theme.fg('muted', ` #${message.roomId}`)}`;
  const messageLines = message.message.split(/\r?\n/).flatMap((line) => {
    const text = line.length === 0 ? '␤' : line;
    return wrapTextWithAnsi(text, width).map((wrapped) => truncateToWidth(wrapped, width));
  });

  return [truncateToWidth(badge, width), ...messageLines];
}
