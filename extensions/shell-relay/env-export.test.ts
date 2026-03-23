import { describe, expect, it } from 'vitest';
import { exportVar, exportVars } from './env-export.js';

describe('exportVar', () => {
  const envVar = { name: 'MY_VAR', value: '/tmp/test-path' };

  it('should generate fish set -gx syntax', () => {
    expect(exportVar('fish', envVar)).toBe("set -gx MY_VAR '/tmp/test-path'");
  });

  it('should generate bash export syntax', () => {
    expect(exportVar('bash', envVar)).toBe("export MY_VAR='/tmp/test-path'");
  });

  it('should generate zsh export syntax', () => {
    expect(exportVar('zsh', envVar)).toBe("export MY_VAR='/tmp/test-path'");
  });

  it('should escape single quotes in values', () => {
    const varWithQuote = { name: 'MY_VAR', value: "/tmp/it's-a-path" };
    expect(exportVar('fish', varWithQuote)).toBe("set -gx MY_VAR '/tmp/it'\\''s-a-path'");
    expect(exportVar('bash', varWithQuote)).toBe("export MY_VAR='/tmp/it'\\''s-a-path'");
  });
});

describe('exportVars', () => {
  const vars = [
    { name: 'SHELL_RELAY_SIGNAL', value: '/tmp/shell-relay/abc/signal' },
    { name: 'SHELL_RELAY_STDOUT', value: '/tmp/shell-relay/abc/stdout' },
    { name: 'SHELL_RELAY_STDERR', value: '/tmp/shell-relay/abc/stderr' },
  ];

  it('should join fish exports with semicolons', () => {
    const result = exportVars('fish', vars);
    expect(result).toBe(
      "set -gx SHELL_RELAY_SIGNAL '/tmp/shell-relay/abc/signal'; " +
        "set -gx SHELL_RELAY_STDOUT '/tmp/shell-relay/abc/stdout'; " +
        "set -gx SHELL_RELAY_STDERR '/tmp/shell-relay/abc/stderr'",
    );
  });

  it('should join bash exports with semicolons', () => {
    const result = exportVars('bash', vars);
    expect(result).toBe(
      "export SHELL_RELAY_SIGNAL='/tmp/shell-relay/abc/signal'; " +
        "export SHELL_RELAY_STDOUT='/tmp/shell-relay/abc/stdout'; " +
        "export SHELL_RELAY_STDERR='/tmp/shell-relay/abc/stderr'",
    );
  });

  it('should handle empty vars array', () => {
    expect(exportVars('fish', [])).toBe('');
  });

  it('should handle single var', () => {
    expect(exportVars('zsh', [{ name: 'FOO', value: 'bar' }])).toBe("export FOO='bar'");
  });
});
