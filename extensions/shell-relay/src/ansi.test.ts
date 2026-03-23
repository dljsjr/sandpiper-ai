import { describe, expect, it } from 'vitest';
import { stripTerminalQueries } from './ansi.js';

describe('stripTerminalQueries', () => {
  it('should strip OSC color query sequences (BEL terminated)', () => {
    const input = '\x1b]10;?\x07normal text\x1b]11;?\x07';
    expect(stripTerminalQueries(input)).toBe('normal text');
  });

  it('should strip OSC color query sequences (ST terminated)', () => {
    const input = '\x1b]10;rgb:cccc/cccc/cccc\x1b\\normal text';
    expect(stripTerminalQueries(input)).toBe('normal text');
  });

  it('should strip device attributes response', () => {
    const input = '\x1b[?62;4cnormal text';
    expect(stripTerminalQueries(input)).toBe('normal text');
  });

  it('should strip erase to end of line', () => {
    const input = 'line1\x1b[K\nline2\x1b[0K';
    expect(stripTerminalQueries(input)).toBe('line1\nline2');
  });

  it('should strip multiple mixed sequences', () => {
    const input = '\x1b]10;?\x07\x1b]11;?\x07\x1b[?62;4cactual output\x1b[K\n';
    expect(stripTerminalQueries(input)).toBe('actual output\n');
  });

  it('should preserve normal ANSI color codes', () => {
    const input = '\x1b[38;5;2mgreen\x1b[0m normal';
    expect(stripTerminalQueries(input)).toBe('\x1b[38;5;2mgreen\x1b[0m normal');
  });

  it('should preserve SGR sequences (bold, underline, etc.)', () => {
    const input = '\x1b[1mbold\x1b[22m \x1b[4munderline\x1b[24m';
    expect(stripTerminalQueries(input)).toBe('\x1b[1mbold\x1b[22m \x1b[4munderline\x1b[24m');
  });

  it('should handle empty string', () => {
    expect(stripTerminalQueries('')).toBe('');
  });

  it('should handle string with no sequences', () => {
    expect(stripTerminalQueries('just plain text')).toBe('just plain text');
  });

  it('should strip the exact sequences seen from jj log output', () => {
    // Real output captured from jj log through unbuffer-relay
    const input = '\x1b]10;?\x1b]11;?\x1b[?62;4c\x1b[1m\x1b[38;5;2m@\x1b[0m  commit text\x1b[K\n';
    const expected = '\x1b[1m\x1b[38;5;2m@\x1b[0m  commit text\n';
    expect(stripTerminalQueries(input)).toBe(expected);
  });
});
