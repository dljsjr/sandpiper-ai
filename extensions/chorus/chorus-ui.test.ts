import { describe, expect, test } from 'vitest';
import { type ChorusReplyRouteV0, roomId, type TattlerMessageId } from '../tattler/tattler-protocol';
import type { ChorusIncomingMessageDetails, ChorusTranscriptEntry } from './chorus-runtime';
import {
  computeChorusTranscriptLineBudget,
  createChorusMessageComponent,
  formatChorusTranscriptEntryLines,
  parseChorusEditorSubmission,
  selectTranscriptLinesWithinBudget,
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
      1,
    ).render(80);

    expect(lines.join('\n')).toContain('<fg:success>[Piper]</fg:success>');
    expect(lines.join('\n')).toContain('<bg:toolSuccessBg>');
  });

  test('styles non-self chat messages with default room tag color and background', () => {
    const lines = createChorusMessageComponent(messageDetails(), markerTheme, 1).render(80);

    expect(lines.join('\n')).toContain('<fg:accent>[Huginn]</fg:accent>');
    expect(lines.join('\n')).toContain('<bg:customMessageBg>');
  });

  test('honors outputPad for horizontal padding, matching Box(outputPad, 1, ...)', () => {
    const paddedLines = createChorusMessageComponent(messageDetails(), markerTheme, 1).render(80);
    const unpaddedLines = createChorusMessageComponent(messageDetails(), markerTheme, 0).render(80);

    // Box(paddingX, 1, bgFn) prepends paddingX spaces to content before applying the
    // background wrap, so a padded line reads '<bg:...> <content>' (space right after the
    // opening tag) while an unpadded line reads '<bg:...><content>' (no space).
    expect(paddedLines[1]).toContain('<bg:customMessageBg> <bold>');
    expect(unpaddedLines[1]).toContain('<bg:customMessageBg><bold>');
  });
});

describe('Chorus transcript line budget (AGENT-256)', () => {
  test('caps at the flat budget on roomy terminals', () => {
    expect(computeChorusTranscriptLineBudget(42)).toBe(30);
    expect(computeChorusTranscriptLineBudget(80)).toBe(30);
  });

  test('scales down on shorter terminals, reserving room for editor/footer/status', () => {
    expect(computeChorusTranscriptLineBudget(24)).toBe(12);
  });

  test('never returns less than 1, even on a terminal too short to reserve from', () => {
    expect(computeChorusTranscriptLineBudget(5)).toBe(1);
    expect(computeChorusTranscriptLineBudget(1)).toBe(1);
  });

  test('keeps all entries when the total is within budget', () => {
    const entries = [
      transcriptEntry('one', { from: 'A' }),
      transcriptEntry('two', { from: 'B' }),
      transcriptEntry('three', { from: 'C' }),
    ];

    expect(selectTranscriptLinesWithinBudget(entries, 80, plainTheme, 10)).toEqual(['[A] one', '[B] two', '[C] three']);
  });

  test('drops the OLDEST entries first once the total exceeds budget', () => {
    const entries = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'].map((message, index) =>
      transcriptEntry(message, { from: `P${index + 1}` }),
    );

    // Each entry renders as exactly one line at this width, so a budget of 2 keeps only
    // the two most recent (newest) entries and silently drops the four oldest.
    const lines = selectTranscriptLinesWithinBudget(entries, 80, plainTheme, 2);

    expect(lines).toEqual(['[P5] m5', '[P6] m6']);
  });

  test('always renders at least the most recent entry, even if it alone exceeds the budget', () => {
    const entries = [transcriptEntry('alpha beta\nbravo charlie\ndelta echo\nfoxtrot golf', { from: 'Long' })];

    // formatChorusTranscriptEntryLines renders this as 4 lines; budget of 1 is smaller than
    // that, but there is no narrower fallback than "show the latest message".
    const lines = selectTranscriptLinesWithinBudget(entries, 80, plainTheme, 1);

    expect(lines).toEqual(formatChorusTranscriptEntryLines(entries[0] as ChorusTranscriptEntry, 80, plainTheme));
  });

  test('fits more entries within budget when messages are short than when they are long', () => {
    const shortEntries = ['s1', 's2', 's3', 's4', 's5'].map((message, index) =>
      transcriptEntry(message, { from: `S${index + 1}` }),
    );
    const longEntries = shortEntries.map((entry) =>
      transcriptEntry('alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu', {
        from: entry.from,
      }),
    );
    const countIncludedEntries = (lines: string[]) => lines.filter((line) => line.startsWith('[')).length;

    // Same budget, same entry count offered -- short single-line messages fit more of the
    // history than long multi-line ones (3 wrapped lines apiece at this width), which is the
    // whole point of a line budget over an entry-count cap: history depth trades off against
    // message length instead of being fixed regardless of it.
    const shortResult = selectTranscriptLinesWithinBudget(shortEntries, 30, plainTheme, 6);
    const longResult = selectTranscriptLinesWithinBudget(longEntries, 30, plainTheme, 6);

    expect(shortResult).toEqual(['[S1] s1', '[S2] s2', '[S3] s3', '[S4] s4', '[S5] s5']);
    expect(countIncludedEntries(shortResult)).toBe(5);
    expect(countIncludedEntries(longResult)).toBe(2);
    expect(countIncludedEntries(shortResult)).toBeGreaterThan(countIncludedEntries(longResult));
    expect(shortResult.length).toBeLessThanOrEqual(6);
    expect(longResult.length).toBeLessThanOrEqual(6);
  });

  test('never exceeds a small-terminal budget derived from computeChorusTranscriptLineBudget', () => {
    const entries = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8'].map((message, index) =>
      transcriptEntry(message, { from: `P${index + 1}` }),
    );
    const budget = computeChorusTranscriptLineBudget(24);

    const lines = selectTranscriptLinesWithinBudget(entries, 80, plainTheme, budget);

    expect(lines.length).toBeLessThanOrEqual(budget);
  });
});
