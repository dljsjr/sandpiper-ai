import { describe, expect, it } from 'vitest';
import { parsePromptEditorOptions } from './options.js';

describe('parsePromptEditorOptions', () => {
  it('strips the editor flags and keeps the Sandpiper options in order', () => {
    const options = parsePromptEditorOptions(
      [
        '--approve',
        '--edit',
        '--prompt-source',
        'prompts/voice.md',
        '--tools',
        'read',
        '--edit-title',
        'Roux',
        '--prompt-source-xml',
        '/abs/SELF.md',
        '--edit-subtitle',
        'Pilot',
        '--json',
      ],
      '/work',
    );

    expect(options).toEqual({
      diagnosticArgs: ['--approve', '--tools', 'read'],
      promptSources: ['/work/prompts/voice.md'],
      escapedPromptSources: ['/abs/SELF.md'],
      title: 'Roux',
      subtitle: 'Pilot',
    });
  });

  it('titles the editor Sandpiper by default', () => {
    expect(parsePromptEditorOptions(['--edit'], '/work')).toEqual({
      diagnosticArgs: [],
      promptSources: [],
      escapedPromptSources: [],
      title: 'Sandpiper',
    });
  });

  it('rejects an editor flag without a value', () => {
    expect(() => parsePromptEditorOptions(['--edit', '--prompt-source'], '/work')).toThrow(
      '--prompt-source requires a value',
    );
  });
});
