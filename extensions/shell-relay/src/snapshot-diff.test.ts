import { describe, expect, it } from 'vitest';
import { extractCommandOutput } from './snapshot-diff.js';

describe('extractCommandOutput', () => {
  const PROMPT = '╰─  24.14.1    abc (no descr…  · deadbeef  ❯';

  it('should extract simple single-line output', () => {
    const before = [PROMPT, ''].join('\n');
    const after = [PROMPT, "__relay_run 'echo hello'", 'hello', PROMPT, ''].join('\n');

    expect(extractCommandOutput(before, after, "__relay_run 'echo hello'")).toBe('hello');
  });

  it('should extract multi-line output', () => {
    const before = [PROMPT, ''].join('\n');
    const after = [PROMPT, "__relay_run 'echo a; echo b; echo c'", 'a', 'b', 'c', PROMPT, ''].join('\n');

    expect(extractCommandOutput(before, after, "__relay_run 'echo a; echo b; echo c'")).toBe('a\nb\nc');
  });

  it('should return empty string when command produces no output', () => {
    const before = [PROMPT, ''].join('\n');
    const after = [PROMPT, "__relay_run 'true'", PROMPT, ''].join('\n');

    expect(extractCommandOutput(before, after, "__relay_run 'true'")).toBe('');
  });

  it('should handle output with error messages', () => {
    const before = [PROMPT, ''].join('\n');
    const after = [
      PROMPT,
      "__relay_run 'ls /nonexistent'",
      'ls: /nonexistent: No such file or directory',
      PROMPT,
      '',
    ].join('\n');

    expect(extractCommandOutput(before, after, "__relay_run 'ls /nonexistent'")).toBe(
      'ls: /nonexistent: No such file or directory',
    );
  });

  it('should handle prior history in the scrollback', () => {
    const before = ['some previous output', 'more previous output', PROMPT, ''].join('\n');
    const after = [
      'some previous output',
      'more previous output',
      PROMPT,
      "__relay_run 'echo new'",
      'new',
      PROMPT,
      '',
    ].join('\n');

    expect(extractCommandOutput(before, after, "__relay_run 'echo new'")).toBe('new');
  });

  it('should handle output with blank lines', () => {
    const before = [PROMPT, ''].join('\n');
    const after = [PROMPT, '__relay_run \'printf "a\\n\\nb"\'', 'a', '', 'b', PROMPT, ''].join('\n');

    expect(extractCommandOutput(before, after, '__relay_run \'printf "a\\n\\nb"\'')).toBe('a\n\nb');
  });

  it('should handle identical before and after (no command ran)', () => {
    const snapshot = [PROMPT, ''].join('\n');
    expect(extractCommandOutput(snapshot, snapshot, "__relay_run 'anything'")).toBe('');
  });

  it('should handle wrapped command echo in narrow viewport', () => {
    const before = [PROMPT, ''].join('\n');
    // At 50 cols, the __relay_run line wraps and output starts on a continuation line
    const after = [
      PROMPT,
      '__relay_run \'echo "line one"; echo "line',
      ' two"; echo "line three"\'',
      'line one',
      'line two',
      'line three',
      PROMPT,
      '',
    ].join('\n');

    // The injected text is the full unwrapped string
    const injected = '__relay_run \'echo "line one"; echo "line two"; echo "line three"\'';
    const result = extractCommandOutput(before, after, injected);
    expect(result).toContain('line one');
    expect(result).toContain('line two');
    expect(result).toContain('line three');
  });

  it('should handle output merged with command on same line (extreme narrow viewport)', () => {
    const before = [PROMPT, ''].join('\n');
    // Output starts on the same line as the closing quote
    const after = [PROMPT, "__relay_run 'echo hi'hi", PROMPT, ''].join('\n');

    const result = extractCommandOutput(before, after, "__relay_run 'echo hi'");
    expect(result).toBe('hi');
  });

  it('should handle different prompt styles', () => {
    const customPrompt = '$ ';
    const before = [customPrompt, ''].join('\n');
    const after = [customPrompt, "__relay_run 'ls'", 'file1.txt', 'file2.txt', customPrompt, ''].join('\n');

    expect(extractCommandOutput(before, after, "__relay_run 'ls'")).toBe('file1.txt\nfile2.txt');
  });

  it('should handle multi-line prompt decorations', () => {
    const promptLine1 = '~/project main*';
    const promptLine2 = '❯ ';
    const before = [promptLine1, promptLine2, ''].join('\n');
    const after = [promptLine1, promptLine2, "__relay_run 'echo hi'", 'hi', promptLine1, promptLine2, ''].join('\n');

    expect(extractCommandOutput(before, after, "__relay_run 'echo hi'")).toBe('hi');
  });

  it('should handle long output', () => {
    const before = [PROMPT, ''].join('\n');
    const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`);
    const after = [PROMPT, "__relay_run 'generate'", ...lines, PROMPT, ''].join('\n');

    const result = extractCommandOutput(before, after, "__relay_run 'generate'");
    expect(result.split('\n')).toHaveLength(100);
    expect(result).toContain('line 1');
    expect(result).toContain('line 100');
  });
});
