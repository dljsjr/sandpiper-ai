import { describe, expect, test } from 'vitest';
import { parseChorusEditorSubmission } from './chorus-ui';

describe('Chorus room UI helpers', () => {
  test('parses room messages by default', () => {
    expect(parseChorusEditorSubmission(' hello room ')).toEqual({ kind: 'room', message: 'hello room' });
  });

  test('parses /agent submissions as local-agent prompts', () => {
    expect(parseChorusEditorSubmission('/agent talk to the local agent')).toEqual({
      kind: 'local-agent',
      message: 'talk to the local agent',
    });
  });

  test('ignores empty submissions', () => {
    expect(parseChorusEditorSubmission('   ')).toEqual({ kind: 'empty' });
    expect(parseChorusEditorSubmission('/agent   ')).toEqual({ kind: 'empty' });
  });
});
