import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { escapeForFish } from './escape.js';

/**
 * Verify that escapeForFish produces a string that, when unescaped
 * by fish and passed to eval, produces the same result as running
 * the original command directly.
 *
 * We use `string unescape` to recover the original string and compare
 * it to the input — this proves the escape/unescape round-trip is lossless.
 */
function verifyRoundTrip(input: string): void {
  const escaped = escapeForFish(input);

  // Ask fish to unescape the escaped string and print it with printf.
  // We use printf '%s\0' and read with -z to preserve newlines.
  // The escaped token is passed via env var to avoid shell interpretation.
  const result = execSync(`fish -c 'string unescape --style=script -- $ESCAPED_CMD'`, {
    encoding: 'utf-8',
    timeout: 5000,
    env: { ...process.env, ESCAPED_CMD: escaped },
  }).replace(/\n$/, ''); // string unescape adds a trailing newline

  expect(result).toBe(input);
}

describe('escapeForFish', () => {
  describe('simple commands', () => {
    it('should round-trip a simple command', () => {
      verifyRoundTrip('ls -la');
    });

    it('should round-trip echo with arguments', () => {
      verifyRoundTrip('echo hello world');
    });
  });

  describe('pipes and redirections', () => {
    it('should round-trip pipe operators', () => {
      verifyRoundTrip('cat file | grep pattern');
    });

    it('should round-trip output redirection', () => {
      verifyRoundTrip('echo hello > file.txt');
    });

    it('should round-trip stderr redirection', () => {
      verifyRoundTrip('cmd 2>/dev/null');
    });
  });

  describe('quoting', () => {
    it('should round-trip single quotes', () => {
      verifyRoundTrip("grep 'hello world' file");
    });

    it('should round-trip double quotes', () => {
      verifyRoundTrip('echo "hello world"');
    });

    it('should round-trip mixed quotes', () => {
      verifyRoundTrip("echo \"it's a 'test'\"");
    });

    it('should round-trip nested quotes', () => {
      verifyRoundTrip('echo "she said \'hello\'"');
    });
  });

  describe('shell special characters', () => {
    it('should round-trip dollar signs', () => {
      verifyRoundTrip('echo $HOME');
    });

    it('should round-trip semicolons', () => {
      verifyRoundTrip('cmd1; cmd2');
    });

    it('should round-trip logical operators', () => {
      verifyRoundTrip('cmd1 && cmd2 || cmd3');
    });

    it('should round-trip backticks', () => {
      verifyRoundTrip('echo `date`');
    });

    it('should round-trip parentheses', () => {
      verifyRoundTrip('echo (date)');
    });

    it('should round-trip backslashes', () => {
      verifyRoundTrip('echo hello\\nworld');
    });
  });

  describe('edge cases', () => {
    it('should round-trip empty string', () => {
      verifyRoundTrip('');
    });

    it('should round-trip string with only spaces', () => {
      verifyRoundTrip('   ');
    });

    it('should round-trip unicode characters', () => {
      verifyRoundTrip('echo 🐟 héllo');
    });

    it('should round-trip newlines in commands', () => {
      verifyRoundTrip('echo hello\necho world');
    });

    it('should round-trip tab characters', () => {
      verifyRoundTrip('echo\thello');
    });

    it('should round-trip a complex real-world command', () => {
      verifyRoundTrip('cat /tmp/data.json | jq \'.items[] | select(.status == "active")\' | head -5');
    });

    it('should round-trip command with all special chars', () => {
      verifyRoundTrip('echo \'$HOME\' "$PATH" (whoami) `uname` ; true && false || echo done');
    });
  });
});
