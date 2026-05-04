import { describe, expect, it } from 'vitest';
import { createAutoToonPostToolUseHookOutput } from './autotoon-post-tool-use.js';

function longJsonFixture(): string {
  return JSON.stringify(
    Array.from({ length: 16 }, (_, index) => ({
      id: index,
      name: `fixture-${index}`,
      status: 'active',
      owner: 'sandpiper',
    })),
  );
}

describe('AutoTOON PostToolUse hook adapter', () => {
  it('replaces string tool output with TOON when AutoTOON converts it', () => {
    const output = createAutoToonPostToolUseHookOutput({
      hook_event_name: 'PostToolUse',
      tool_response: longJsonFixture(),
    });

    expect(output).toMatchObject({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        updatedToolOutput: expect.stringContaining('[TOON]\n'),
      },
    });
  });

  it('replaces text content blocks without changing non-text blocks', () => {
    const output = createAutoToonPostToolUseHookOutput({
      hook_event_name: 'PostToolUse',
      tool_response: {
        content: [
          { type: 'text', text: longJsonFixture() },
          { type: 'image', data: 'abc123', mimeType: 'image/png' },
        ],
      },
    });

    expect(output).toEqual({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        updatedToolOutput: {
          content: [
            { type: 'text', text: expect.stringContaining('[TOON]\n') },
            { type: 'image', data: 'abc123', mimeType: 'image/png' },
          ],
        },
      },
    });
  });

  it('returns null when no output field was converted', () => {
    const output = createAutoToonPostToolUseHookOutput({
      hook_event_name: 'PostToolUse',
      tool_response: 'not json',
    });

    expect(output).toBeNull();
  });
});
