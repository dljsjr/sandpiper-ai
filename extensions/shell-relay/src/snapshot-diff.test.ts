import { describe, expect, it } from 'vitest';
import { extractCommandOutput } from './snapshot-diff.js';

describe('extractCommandOutput', () => {
  const PROMPT = '╰─  24.14.1    abc (no descr…  · deadbeef  ❯';

  it('should extract simple single-line output', () => {
    const before = [PROMPT, ''].join('\n');
    const after = [PROMPT, "echo 'hello'", 'hello', PROMPT, ''].join('\n');

    expect(extractCommandOutput(before, after, "echo 'hello'")).toBe('hello');
  });

  it('should extract multi-line output', () => {
    const before = [PROMPT, ''].join('\n');
    const after = [PROMPT, "echo 'a'; echo 'b'; echo 'c'", 'a', 'b', 'c', PROMPT, ''].join('\n');

    const result = extractCommandOutput(before, after, "echo 'a'; echo 'b'; echo 'c'");
    expect(result).toBe('a\nb\nc');
  });

  it('should return empty string when command produces no output', () => {
    const before = [PROMPT, ''].join('\n');
    const after = [PROMPT, 'true', PROMPT, ''].join('\n');

    expect(extractCommandOutput(before, after, 'true')).toBe('');
  });

  it('should handle output with error messages', () => {
    const before = [PROMPT, ''].join('\n');
    const after = [PROMPT, 'ls /nonexistent', 'ls: /nonexistent: No such file or directory', PROMPT, ''].join('\n');

    expect(extractCommandOutput(before, after, 'ls /nonexistent')).toBe('ls: /nonexistent: No such file or directory');
  });

  it('should handle prior history in the scrollback', () => {
    const before = ['some previous output', 'more previous output', PROMPT, ''].join('\n');
    const after = ['some previous output', 'more previous output', PROMPT, "echo 'new'", 'new', PROMPT, ''].join('\n');

    expect(extractCommandOutput(before, after, "echo 'new'")).toBe('new');
  });

  it('should handle output with blank lines', () => {
    const before = [PROMPT, ''].join('\n');
    const after = [PROMPT, "printf 'a\\n\\nb'", 'a', '', 'b', PROMPT, ''].join('\n');

    expect(extractCommandOutput(before, after, "printf 'a\\n\\nb'")).toBe('a\n\nb');
  });

  it('should handle identical before and after (no command ran)', () => {
    const snapshot = [PROMPT, ''].join('\n');
    expect(extractCommandOutput(snapshot, snapshot, 'anything')).toBe('');
  });

  it('should handle command with special characters', () => {
    const before = [PROMPT, ''].join('\n');
    const command = "grep -r 'foo|bar' src/ | head -5";
    const after = [PROMPT, command, 'src/main.ts:  foo', 'src/lib.ts:  bar', PROMPT, ''].join('\n');

    const result = extractCommandOutput(before, after, command);
    expect(result).toBe('src/main.ts:  foo\nsrc/lib.ts:  bar');
  });

  it('should handle different prompt styles', () => {
    const customPrompt = '$ ';
    const before = [customPrompt, ''].join('\n');
    const after = [customPrompt, 'ls', 'file1.txt', 'file2.txt', customPrompt, ''].join('\n');

    expect(extractCommandOutput(before, after, 'ls')).toBe('file1.txt\nfile2.txt');
  });

  it('should handle multi-line prompt decorations', () => {
    const promptLine1 = '~/project main*';
    const promptLine2 = '❯ ';
    const before = [promptLine1, promptLine2, ''].join('\n');
    const after = [promptLine1, promptLine2, 'echo hi', 'hi', promptLine1, promptLine2, ''].join('\n');

    expect(extractCommandOutput(before, after, 'echo hi')).toBe('hi');
  });

  it('should handle wrapped command echo in narrow viewport', () => {
    // Simulates a 50-col viewport where the command echo wraps and merges with output
    const before = [PROMPT, ''].join('\n');
    const after = [
      PROMPT,
      // Command wraps across lines in narrow viewport, output starts on same line
      '__relay_run \'echo "line one"; echo "line',
      ' two"; echo "line three"\'',
      'line one',
      'line two',
      'line three',
      PROMPT,
      '',
    ].join('\n');

    const result = extractCommandOutput(before, after, 'echo "line one"; echo "line two"; echo "line three"');
    expect(result).toContain('line one');
    expect(result).toContain('line two');
    expect(result).toContain('line three');
  });

  it.skip('should handle output concatenated with command on same line (extreme wrapping)', () => {
    // When viewport is very narrow, output may start on the same line as the command echo
    const before = [PROMPT, ''].join('\n');
    const after = [PROMPT, "__relay_run 'echo hi'hi", PROMPT, ''].join('\n');

    const result = extractCommandOutput(before, after, 'echo hi');
    // The 'hi' is on the same line as the command — we should still extract it
    expect(result).toBe('hi');
  });

  it('should handle long output that fills the scrollback', () => {
    const before = [PROMPT, ''].join('\n');
    const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`);
    const after = [PROMPT, 'generate-output', ...lines, PROMPT, ''].join('\n');

    const result = extractCommandOutput(before, after, 'generate-output');
    expect(result.split('\n')).toHaveLength(100);
    expect(result).toContain('line 1');
    expect(result).toContain('line 100');
  });
});
