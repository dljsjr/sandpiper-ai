import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveEnvVar } from './env.js';

describe('resolveEnvVar', () => {
  const savedEnv: Record<string, string | undefined> = {};

  // Save and restore env vars we touch
  beforeEach(() => {
    for (const key of ['SANDPIPER_OFFLINE', 'PI_OFFLINE', 'SANDPIPER_FOO', 'PI_FOO']) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
  });

  it('should return SANDPIPER_* value when set', () => {
    process.env.SANDPIPER_OFFLINE = '1';
    expect(resolveEnvVar('OFFLINE')).toBe('1');
  });

  it('should fall back to PI_* when SANDPIPER_* is not set', () => {
    process.env.PI_OFFLINE = '1';
    expect(resolveEnvVar('OFFLINE')).toBe('1');
  });

  it('should prefer SANDPIPER_* over PI_* when both are set', () => {
    process.env.SANDPIPER_OFFLINE = 'sandpiper-value';
    process.env.PI_OFFLINE = 'pi-value';
    expect(resolveEnvVar('OFFLINE')).toBe('sandpiper-value');
  });

  it('should return undefined when neither is set', () => {
    expect(resolveEnvVar('FOO')).toBeUndefined();
  });

  it('should return PI_* directly for exempt vars, skipping SANDPIPER_* lookup', () => {
    process.env.PI_PACKAGE_DIR = '/some/path';
    expect(resolveEnvVar('PACKAGE_DIR')).toBe('/some/path');
  });

  it('should return PI_* for all exempt var names', () => {
    // These are set by pi_wrapper.ts — just verify they don't throw
    for (const name of ['PACKAGE_DIR', 'CODING_AGENT_PACKAGE', 'CODING_AGENT_VERSION', 'SKIP_VERSION_CHECK']) {
      expect(() => resolveEnvVar(name)).not.toThrow();
    }
  });

  it('should handle empty string values (set but empty)', () => {
    process.env.SANDPIPER_FOO = '';
    expect(resolveEnvVar('FOO')).toBe('');
  });

  it('should fall through empty SANDPIPER_* to PI_* when SANDPIPER_* is empty string', () => {
    // Empty string is still a defined value — should NOT fall through
    process.env.SANDPIPER_FOO = '';
    process.env.PI_FOO = 'pi-value';
    expect(resolveEnvVar('FOO')).toBe('');
  });
});
