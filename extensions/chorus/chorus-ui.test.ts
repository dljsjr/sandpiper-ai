import { describe, expect, test } from 'vitest';
import { roomId, type TattlerMessageId } from '../tattler/tattler-protocol';
import type { ChorusTranscriptEntry } from './chorus-runtime';
import { formatChorusTranscriptEntryLines, parseChorusEditorSubmission } from './chorus-ui';

const theme = {
  fg: (_color: 'accent' | 'dim' | 'muted' | 'success', text: string) => text,
  bg: (_color: 'customMessageBg', text: string) => text,
  bold: (text: string) => text,
};

function transcriptEntry(message: string, options: Partial<ChorusTranscriptEntry> = {}): ChorusTranscriptEntry {
  return {
    id: 'post-1' as TattlerMessageId,
    roomId: roomId('chorus-dev'),
    from: 'Doug',
    message,
    self: false,
    status: 'received',
    peerStatuses: new Map(),
    ...options,
  };
}

describe('Chorus room UI helpers', () => {
  test('parses room messages by default', () => {
    expect(parseChorusEditorSubmission(' hello room ')).toEqual({ kind: 'room', message: 'hello room' });
  });

  test('passes /agent submissions through to the registered app command', () => {
    expect(parseChorusEditorSubmission('/agent talk to the local agent')).toEqual({
      kind: 'app-command',
      command: '/agent talk to the local agent',
    });
  });

  test('escapes doubled slashes as literal room messages', () => {
    expect(parseChorusEditorSubmission('//agent talk to the room')).toEqual({
      kind: 'room',
      message: '/agent talk to the room',
    });
    expect(parseChorusEditorSubmission('//chorus')).toEqual({ kind: 'room', message: '/chorus' });
    expect(parseChorusEditorSubmission('//')).toEqual({ kind: 'room', message: '/' });
  });

  test('passes slash commands through to the app while the room editor is active', () => {
    expect(parseChorusEditorSubmission('/chorus')).toEqual({ kind: 'app-command', command: '/chorus' });
    expect(parseChorusEditorSubmission('/clear')).toEqual({ kind: 'app-command', command: '/clear' });
  });

  test('ignores empty submissions', () => {
    expect(parseChorusEditorSubmission('   ')).toEqual({ kind: 'empty' });
  });

  test('renders multiline transcript entries as separate indented rows', () => {
    expect(formatChorusTranscriptEntryLines(transcriptEntry('hello\nworld'), 80, theme)).toEqual([
      '[Doug] hello',
      '       world',
    ]);
  });

  test('renders blank transcript lines without embedding raw newlines', () => {
    expect(formatChorusTranscriptEntryLines(transcriptEntry('\nhello\n'), 80, theme)).toEqual([
      '[Doug] ␤',
      '       hello',
      '       ␤',
    ]);
  });

  test('wraps and caps long multiline transcript entries', () => {
    expect(
      formatChorusTranscriptEntryLines(
        transcriptEntry('alpha beta gamma delta epsilon zeta eta theta iota kappa\nsecond line\nthird line'),
        30,
        theme,
      ),
    ).toEqual([
      '[Doug] alpha beta gamma delta',
      '       epsilon zeta eta theta',
      '       iota kappa',
      '       … 2 more lines',
    ]);
  });
});
