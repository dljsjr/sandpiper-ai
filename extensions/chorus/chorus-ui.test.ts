import { describe, expect, test } from 'vitest';
import { parseChorusEditorSubmission } from './chorus-ui';

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
});
