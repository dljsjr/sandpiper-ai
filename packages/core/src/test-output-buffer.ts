import type { CreateProcessOutputBuffer, ProcessOutputBuffer, ProcessOutputStream } from './process-manager.js';

/** Keeps all output in memory and records its lifecycle calls, for ProcessManager tests. */
export class RecordingOutputBuffer implements ProcessOutputBuffer {
  readonly events: string[] = [];
  private readonly chunks: Buffer[] = [];

  append(data: Buffer): void {
    this.chunks.push(data);
  }

  finish(): void {
    this.events.push('finish');
  }

  snapshot() {
    const content = Buffer.concat(this.chunks).toString('utf-8');
    const lines = content.split('\n');
    const totalLines = content === '' ? 0 : content.endsWith('\n') ? lines.length - 1 : lines.length;
    return { content, truncation: { truncated: false, totalLines, totalBytes: Buffer.byteLength(content) } };
  }

  async closeTempFile(): Promise<void> {
    this.events.push('closeTempFile');
  }
}

export interface CreatedOutputBuffer {
  readonly processId: string;
  readonly stream: ProcessOutputStream;
  readonly buffer: RecordingOutputBuffer;
}

export function recordingOutputBuffers(): { create: CreateProcessOutputBuffer; created: CreatedOutputBuffer[] } {
  const created: CreatedOutputBuffer[] = [];
  return {
    created,
    create: (processId, stream) => {
      const buffer = new RecordingOutputBuffer();
      created.push({ processId, stream, buffer });
      return buffer;
    },
  };
}
