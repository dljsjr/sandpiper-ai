import { EventEmitter } from 'node:events';

/**
 * Signal events emitted by the shell relay signal channel.
 */
export type SignalEvent =
  | { readonly type: 'prompt_ready' }
  | { readonly type: 'last_status'; readonly exitCode: number };

/**
 * Parses line-delimited signal messages from the signal FIFO
 * and emits typed events.
 *
 * Protocol:
 * - `prompt_ready\n` — pane is at a shell prompt
 * - `last_status:N\n` — command completed with exit code N
 *
 * This module is framework-independent — no pi/sandpiper imports.
 */
export class SignalParser extends EventEmitter {
  private buffer = '';

  /**
   * Feed raw data from the signal FIFO into the parser.
   * Emits "signal" events for each complete, valid line.
   */
  feed(chunk: string): void {
    this.buffer += chunk;

    let newlineIndex = this.buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);

      if (line.length === 0) {
        continue;
      }

      const event = this.parseLine(line);
      if (event) {
        this.emit('signal', event);
      }

      newlineIndex = this.buffer.indexOf('\n');
    }
  }

  /**
   * Wait for a specific signal event type, with a timeout.
   *
   * @param eventType - The event type to wait for ("prompt_ready" or "last_status")
   * @param timeoutMs - Maximum time to wait in milliseconds
   * @returns The matching signal event
   * @throws If the timeout is exceeded
   */
  waitFor(eventType: SignalEvent['type'], timeoutMs: number): Promise<SignalEvent> {
    return new Promise<SignalEvent>((resolve, reject) => {
      const handler = (event: SignalEvent) => {
        if (event.type === eventType) {
          clearTimeout(timer);
          this.removeListener('signal', handler);
          resolve(event);
        }
      };

      const timer = setTimeout(() => {
        this.removeListener('signal', handler);
        reject(new Error(`Waiting for "${eventType}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.on('signal', handler);
    });
  }

  private parseLine(line: string): SignalEvent | null {
    if (line === 'prompt_ready') {
      return { type: 'prompt_ready' };
    }

    if (line.startsWith('last_status:')) {
      const codeStr = line.slice('last_status:'.length);
      const code = parseInt(codeStr, 10);
      if (!Number.isNaN(code) && code >= 0 && String(code) === codeStr) {
        return { type: 'last_status', exitCode: code };
      }
    }

    // Unknown or malformed line — silently ignore
    return null;
  }
}
