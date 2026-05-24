import { describe, expect, test } from 'vitest';
import { type ChorusReplyRouteV0, roomId, type TattlerMessageId } from '../tattler/tattler-protocol';
import type { ChorusIncomingMessageDetails, ChorusTranscriptEntry } from './chorus-runtime';
import {
  createChorusMessageComponent,
  formatChorusTranscriptEntryLines,
  parseChorusEditorSubmission,
} from './chorus-ui';

const plainTheme = {
  fg: (_color: 'accent' | 'dim' | 'muted' | 'success', text: string) => text,
  bg: (_color: 'customMessageBg' | 'toolSuccessBg', text: string) => text,
  bold: (text: string) => text,
};

const markerTheme = {
  fg: (color: 'accent' | 'dim' | 'muted' | 'success', text: string) => `<fg:${color}>${text}</fg:${color}>`,
  bg: (color: 'customMessageBg' | 'toolSuccessBg', text: string) => `<bg:${color}>${text}</bg:${color}>`,
  bold: (text: string) => `<bold>${text}</bold>`,
};

const broker: ChorusReplyRouteV0 = {
  name: 'chorus:chorus-dev',
  shortId: 'chorus-dev',
  socketPath: '/tmp/chorus.sock',
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

function messageDetails(options: Partial<ChorusIncomingMessageDetails> = {}): ChorusIncomingMessageDetails {
  return {
    roomId: roomId('chorus-dev'),
    from: 'Huginn',
    message: 'remote note',
    postId: 'post-2' as TattlerMessageId,
    broker,
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

  test('renders multiline transcript entries as separate flush-left rows', () => {
    expect(formatChorusTranscriptEntryLines(transcriptEntry('hello\nworld'), 80, plainTheme)).toEqual([
      '[Doug] hello',
      'world',
    ]);
  });

  test('renders blank transcript lines without embedding raw newlines', () => {
    expect(formatChorusTranscriptEntryLines(transcriptEntry('\nhello\n'), 80, plainTheme)).toEqual([
      '[Doug] ␤',
      'hello',
      '␤',
    ]);
  });

  test('wraps long transcript entries flush-left regardless of sender length', () => {
    const message = 'alpha beta gamma delta epsilon zeta';

    expect(formatChorusTranscriptEntryLines(transcriptEntry(message, { from: 'Al' }), 20, plainTheme)).toEqual([
      '[Al] alpha beta',
      'gamma delta epsilon',
      'zeta',
    ]);
    expect(
      formatChorusTranscriptEntryLines(transcriptEntry(message, { from: 'LongDisplayName' }), 20, plainTheme),
    ).toEqual(['[LongDisplayName]', 'alpha beta gamma', 'delta epsilon zeta']);
  });

  test('wraps and caps long multiline transcript entries', () => {
    expect(
      formatChorusTranscriptEntryLines(
        transcriptEntry('alpha beta gamma delta epsilon zeta eta theta iota kappa\nsecond line\nthird line'),
        30,
        plainTheme,
      ),
    ).toEqual(['[Doug] alpha beta gamma delta', 'epsilon zeta eta theta iota', 'kappa', '… 2 more lines']);
  });

  test('styles self chat messages with self tag color and background', () => {
    const lines = createChorusMessageComponent(
      messageDetails({ from: 'Piper', message: 'self-authored note', self: true }),
      markerTheme,
    ).render(80);

    expect(lines.join('\n')).toContain('<fg:success>[Piper]</fg:success>');
    expect(lines.join('\n')).toContain('<bg:toolSuccessBg>');
  });

  test('styles non-self chat messages with default room tag color and background', () => {
    const lines = createChorusMessageComponent(messageDetails(), markerTheme).render(80);

    expect(lines.join('\n')).toContain('<fg:accent>[Huginn]</fg:accent>');
    expect(lines.join('\n')).toContain('<bg:customMessageBg>');
  });
});
