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

  test('escapes doubled slashes as literal room messages', () => {
    expect(parseChorusEditorSubmission('//agent talk to the room')).toEqual({
      kind: 'room',
      message: '/agent talk to the room',
    });
    expect(parseChorusEditorSubmission('//chorus')).toEqual({ kind: 'room', message: '/chorus' });
  });

  test('passes slash commands through to the app while the room editor is active', () => {
    expect(parseChorusEditorSubmission('/chorus')).toEqual({ kind: 'app-command', command: '/chorus' });
    expect(parseChorusEditorSubmission('/clear')).toEqual({ kind: 'app-command', command: '/clear' });
  });

  test('ignores empty submissions', () => {
    expect(parseChorusEditorSubmission('   ')).toEqual({ kind: 'empty' });
    expect(parseChorusEditorSubmission('/agent   ')).toEqual({ kind: 'empty' });
  });
});
